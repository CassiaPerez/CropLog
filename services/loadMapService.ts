import { supabase } from './supabase';
import { LoadMap, TimelineEvent } from '../types';

export async function saveLoadMapToDatabase(loadMap: LoadMap): Promise<void> {
  try {
    console.log(`Salvando mapa de carga ${loadMap.code}...`);

    // Salvar o mapa de carga
    const { data: savedMap, error: mapError } = await supabase
      .from('load_maps')
      .upsert({
        id: loadMap.id,
        code: loadMap.code,
        carrier_name: loadMap.carrierName,
        vehicle_plate: loadMap.vehiclePlate,
        source_city: loadMap.sourceCity,
        route: loadMap.route,
        google_maps_link: loadMap.googleMapsLink || null,
        status: loadMap.status,
        current_city: loadMap.currentCity,
        logistics_notes: loadMap.logisticsNotes || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (mapError) {
      console.error(`Erro ao salvar mapa ${loadMap.code}:`, mapError);
      throw mapError;
    }

    // Remover relações antigas
    await supabase
      .from('load_map_invoices')
      .delete()
      .eq('load_map_id', loadMap.id);

    // Salvar novas relações com notas fiscais
    if (loadMap.invoices && loadMap.invoices.length > 0) {
      const relations = loadMap.invoices.map(invoice => ({
        load_map_id: loadMap.id,
        invoice_id: invoice.id
      }));

      const { error: relationsError } = await supabase
        .from('load_map_invoices')
        .insert(relations);

      if (relationsError) {
        console.error(`Erro ao salvar relações do mapa ${loadMap.code}:`, relationsError);
      }
    }

    // Salvar timeline
    if (loadMap.timeline && loadMap.timeline.length > 0) {
      // Buscar eventos existentes
      const { data: existingEvents } = await supabase
        .from('load_map_timeline')
        .select('timestamp, status')
        .eq('load_map_id', loadMap.id);

      // Filtrar apenas eventos novos
      const existingEventKeys = new Set(
        existingEvents?.map(e => `${e.timestamp}-${e.status}`) || []
      );

      const newEvents = loadMap.timeline.filter(event => {
        const eventKey = `${event.timestamp}-${event.status}`;
        return !existingEventKeys.has(eventKey);
      });

      if (newEvents.length > 0) {
        const timelineData = newEvents.map(event => ({
          load_map_id: loadMap.id,
          timestamp: event.timestamp,
          status: event.status,
          description: event.description,
          user_id: event.userId || null,
          user_name: event.userName || null
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

    // Carregar mapas de carga
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
      // Carregar notas fiscais do mapa
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

      // Carregar itens de cada nota fiscal
      const invoices = [];
      if (invoiceRelations && invoiceRelations.length > 0) {
        for (const relation of invoiceRelations) {
          const invoice = (relation as any).invoices;
          if (!invoice) continue;

          // Carregar itens da nota
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
            quantityPicked: item.quantity_picked ? Number(item.quantity_picked) : undefined
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
            items: items,
            isAssigned: invoice.is_assigned
          });
        }
      }

      // Carregar timeline
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
        status: event.status,
        description: event.description,
        userId: event.user_id,
        userName: event.user_name
      }));

      loadMaps.push({
        id: mapData.id,
        code: mapData.code,
        carrierName: mapData.carrier_name,
        vehiclePlate: mapData.vehicle_plate,
        sourceCity: mapData.source_city,
        route: mapData.route,
        googleMapsLink: mapData.google_maps_link || '',
        status: mapData.status,
        currentCity: mapData.current_city || '',
        logisticsNotes: mapData.logistics_notes || '',
        createdAt: mapData.created_at,
        invoices: invoices,
        timeline: timeline
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
