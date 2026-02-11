import { supabase } from './supabase';
import { LoadMap, TimelineEvent } from '../types';

const STATUS_TO_DB: Record<string, string> = {
  'planejamento': 'Planejamento',
  'aguardando_separacao': 'Aguardando Separação',
  'em_separacao': 'Em Separação',
  'separado': 'Separado',
  'separado_com_divergencia': 'Separado com Divergência',
  'pronto': 'Pronto',
  'coletado': 'Coletado',
  'em_transito': 'Em Trânsito',
  'entregue': 'Entregue',
  'cancelado': 'Cancelado',
};

function stripAccents(input: string): string {
  return (input || '')
    .normalize('NFD')
    // remove diacríticos
    .replace(/[\u0300-\u036f]/g, '');
}

function toKey(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const noAccents = stripAccents(raw).toLowerCase();
  return noAccents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toDbStatus(status: unknown): string {
  const key = toKey(status);
  return STATUS_TO_DB[key] ?? String(status ?? '');
}

function fromDbStatus(status: unknown): string {
  const raw = String(status ?? '');
  return raw;
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

function generateUuid(): string {
  const g = (globalThis as any);
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  // eslint-disable-next-line no-bitwise
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveLoadMapToDatabase(loadMap: LoadMap): Promise<void> {
  try {
    const mapId = isUuid(loadMap.id) ? loadMap.id : generateUuid();
    if (mapId !== loadMap.id) {
      console.warn(`⚠️ loadMap.id inválido (não é UUID). Gerando novo UUID: ${mapId}`);
      // @ts-expect-error - dependendo do seu tipo, isso pode ser readonly; mas é útil manter sincronizado no app
      loadMap.id = mapId;
    }

    console.log(`Salvando mapa de carga ${loadMap.code}...`);

    const dbStatus = toDbStatus(loadMap.status);

    // Salvar o mapa de carga
    const { data: savedMap, error: mapError } = await supabase
      .from('load_maps')
      .upsert(
        {
          id: mapId,
          code: loadMap.code,
          carrier_name: loadMap.carrierName,
          vehicle_plate: loadMap.vehiclePlate,
          source_city: loadMap.sourceCity,
          route: loadMap.route,
          google_maps_link: loadMap.googleMapsLink || null,
          status: dbStatus,
          current_city: loadMap.currentCity,
          logistics_notes: loadMap.logisticsNotes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (mapError) {
      console.error(`Erro ao salvar mapa ${loadMap.code}:`, mapError);
      throw mapError;
    }

    const persistedMapId = savedMap?.id ?? mapId;

    // Remover relações antigas
    await supabase
      .from('load_map_invoices')
      .delete()
      .eq('load_map_id', persistedMapId);

    // Salvar novas relações com notas fiscais
    if (loadMap.invoices && loadMap.invoices.length > 0) {
      const relations = loadMap.invoices
        .filter((invoice) => !!invoice?.id)
        .map((invoice) => ({
          load_map_id: persistedMapId,
          invoice_id: invoice.id,
        }));

      if (relations.length > 0) {
        const { error: relationsError } = await supabase
          .from('load_map_invoices')
          .insert(relations);

        if (relationsError) {
          console.error(`Erro ao salvar relações do mapa ${loadMap.code}:`, relationsError);
        }
      }
    }

    // Salvar timeline
    if (loadMap.timeline && loadMap.timeline.length > 0) {
      const { data: existingEvents } = await supabase
        .from('load_map_timeline')
        .select('timestamp, status')
        .eq('load_map_id', persistedMapId);

      const existingEventKeys = new Set(
        (existingEvents || []).map((e: any) => `${e.timestamp}-${toKey(e.status)}`)
      );

      const newEvents = loadMap.timeline.filter((event) => {
        const eventKey = `${event.timestamp}-${toKey(event.status)}`;
        return !existingEventKeys.has(eventKey);
      });

      if (newEvents.length > 0) {
        const timelineData = newEvents.map((event) => ({
          load_map_id: persistedMapId,
          timestamp: event.timestamp,
          status: toDbStatus(event.status),
          description: event.description,
          user_id: event.userId || null,
          user_name: event.userName || null,
        }));

        const { error: timelineError } = await supabase
          .from('load_map_timeline')
          .insert(timelineData);

        if (timelineError) {
          console.error(`Erro ao salvar timeline do mapa ${loadMap.code}:`, timelineError);
        }
      }
    }

    console.log(`Mapa ${loadMap.code} salvo com sucesso`);
  } catch (error) {
    console.error('Erro ao salvar mapa de carga:', error);
    throw error;
  }
}

export async function loadLoadMapsFromDatabase(): Promise<LoadMap[]> {
  try {
    console.log('Carregando mapas de carga do Supabase...');

    const { data: mapsData, error: mapsError } = await supabase
      .from('load_maps')
      .select('*')
      .order('created_at', { ascending: false });

    if (mapsError) {
      console.error('Erro ao carregar mapas:', mapsError);
      return [];
    }

    if (!mapsData || mapsData.length === 0) {
      console.log('Nenhum mapa de carga encontrado');
      return [];
    }

    console.log(`Encontrados ${mapsData.length} mapas de carga`);

    const loadMaps: LoadMap[] = [];

    for (const mapData of mapsData) {
      const { data: invoiceRelations, error: relationsError } = await supabase
        .from('load_map_invoices')
        .select(`
          invoice_id,
          invoices (
            id,
            number,
            customer_name,
            customer_city,
            issue_date,
            document_date,
            total_value,
            total_weight,
            is_assigned
          )
        `)
        .eq('load_map_id', mapData.id);

      if (relationsError) {
        console.error(`Erro ao carregar notas do mapa ${mapData.code}:`, relationsError);
        continue;
      }

      const invoices: any[] = [];
      if (invoiceRelations && invoiceRelations.length > 0) {
        for (const relation of invoiceRelations) {
          const invoice = (relation as any).invoices;
          if (!invoice) continue;

          const { data: itemsData, error: itemsError } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);

          if (itemsError) {
            console.error(`Erro ao carregar itens da nota ${invoice.number}:`, itemsError);
            continue;
          }

          const items = (itemsData || []).map((item: any) => ({
            sku: item.sku,
            description: item.description,
            quantity: Number(item.quantity),
            unit: item.unit,
            weightKg: Number(item.weight_kg),
            quantityPicked: item.quantity_picked ? Number(item.quantity_picked) : undefined,
          }));

          invoices.push({
            id: invoice.id,
            number: invoice.number,
            customerName: invoice.customer_name,
            customerCity: invoice.customer_city,
            issueDate: invoice.issue_date,
            documentDate: invoice.document_date || invoice.issue_date,
            totalValue: Number(invoice.total_value),
            totalWeight: Number(invoice.total_weight),
            items,
            isAssigned: invoice.is_assigned,
          });
        }
      }

      const { data: timelineData, error: timelineError } = await supabase
        .from('load_map_timeline')
        .select('*')
        .eq('load_map_id', mapData.id)
        .order('timestamp', { ascending: true });

      if (timelineError) {
        console.error(`Erro ao carregar timeline do mapa ${mapData.code}:`, timelineError);
      }

      const timeline: TimelineEvent[] = (timelineData || []).map((event: any) => ({
        timestamp: event.timestamp,
        status: fromDbStatus(event.status),
        description: event.description,
        userId: event.user_id,
        userName: event.user_name,
      }));

      loadMaps.push({
        id: mapData.id,
        code: mapData.code,
        carrierName: mapData.carrier_name,
        vehiclePlate: mapData.vehicle_plate,
        sourceCity: mapData.source_city,
        route: mapData.route,
        googleMapsLink: mapData.google_maps_link || '',
        status: fromDbStatus(mapData.status),
        currentCity: mapData.current_city || '',
        logisticsNotes: mapData.logistics_notes || '',
        createdAt: mapData.created_at,
        invoices,
        timeline,
      });
    }

    console.log(`Retornando ${loadMaps.length} mapas de carga completos`);
    return loadMaps;
  } catch (error) {
    console.error('Erro ao carregar mapas do banco:', error);
    return [];
  }
}

export async function deleteLoadMapFromDatabase(loadMapId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('load_maps')
      .delete()
      .eq('id', loadMapId);

    if (error) {
      console.error('Erro ao deletar mapa:', error);
      throw error;
    }

    console.log('Mapa deletado com sucesso');
  } catch (error) {
    console.error('Erro ao deletar mapa:', error);
    throw error;
  }
}
