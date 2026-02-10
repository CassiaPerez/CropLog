import { supabase } from './supabase';
import { LoadMap } from '../types';

export async function saveLoadMapToDatabase(loadMap: LoadMap): Promise<void> {
  try {
    console.log(`Salvando mapa de carga ${loadMap.code}...`);

    const { error: mapError } = await supabase
      .from('load_maps')
      .upsert({
        id: loadMap.id, // ✅ agora vem UUID correto do createLoadMap
        code: loadMap.code,
        carrier_name: loadMap.carrierName,
        vehicle_plate: loadMap.vehiclePlate,
        source_city: loadMap.sourceCity,
        route: loadMap.route,
        google_maps_link: loadMap.googleMapsLink || null,
        status: loadMap.status,
        current_city: loadMap.currentCity,
        logistics_notes: loadMap.logisticsNotes || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (mapError) {
      console.error(`Erro ao salvar mapa ${loadMap.code}:`, mapError);
      throw mapError;
    }

    // Remove relações antigas
    await supabase.from('load_map_invoices').delete().eq('load_map_id', loadMap.id);

    // Insere relações novas
    if (loadMap.invoices && loadMap.invoices.length > 0) {
      const relations = loadMap.invoices.map((invoice) => ({
        load_map_id: loadMap.id,
        invoice_id: invoice.id,
      }));

      const { error: relationsError } = await supabase.from('load_map_invoices').insert(relations);
      if (relationsError) {
        console.error(`Erro ao salvar relações do mapa ${loadMap.code}:`, relationsError);
      }
    }

    // Timeline
    if (loadMap.timeline && loadMap.timeline.length > 0) {
      const { data: existingEvents } = await supabase
        .from('load_map_timeline')
        .select('timestamp, status')
        .eq('load_map_id', loadMap.id);

      const existingEventKeys = new Set(existingEvents?.map((e) => `${e.timestamp}-${e.status}`) || []);

      const newEvents = loadMap.timeline.filter((event) => {
        const eventKey = `${event.timestamp}-${event.status}`;
        return !existingEventKeys.has(eventKey);
      });

      if (newEvents.length > 0) {
        const timelineData = newEvents.map((event) => ({
          load_map_id: loadMap.id,
          timestamp: event.timestamp,
          status: event.status,
          description: event.description,
          user_id: event.userId || null,
          user_name: event.userName || null,
        }));

        const { error: timelineError } = await supabase.from('load_map_timeline').insert(timelineData);

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

    const mapIds = mapsData.map((m: any) => m.id);

    const { data: relationsData } = await supabase
      .from('load_map_invoices')
      .select('load_map_id, invoice_id')
      .in('load_map_id', mapIds);

    const invoiceIds = Array.from(new Set((relationsData || []).map((r: any) => r.invoice_id)));

    const { data: invoicesData } = await supabase.from('invoices').select('*').in('id', invoiceIds);

    const { data: timelineData } = await supabase
      .from('load_map_timeline')
      .select('*')
      .in('load_map_id', mapIds)
      .order('timestamp', { ascending: true });

    const invoicesById = new Map((invoicesData || []).map((inv: any) => [inv.id, inv]));
    const relationsByMap = new Map<string, string[]>();
    for (const rel of relationsData || []) {
      const arr = relationsByMap.get(rel.load_map_id) || [];
      arr.push(rel.invoice_id);
      relationsByMap.set(rel.load_map_id, arr);
    }

    const timelineByMap = new Map<string, any[]>();
    for (const evt of timelineData || []) {
      const arr = timelineByMap.get(evt.load_map_id) || [];
      arr.push(evt);
      timelineByMap.set(evt.load_map_id, arr);
    }

    return (mapsData || []).map((m: any) => {
      const invIds = relationsByMap.get(m.id) || [];
      const invs = invIds
        .map((id) => invoicesById.get(id))
        .filter(Boolean)
        .map((row: any) => ({
          id: row.id,
          number: row.number,
          customerName: row.customer_name,
          customerCity: row.customer_city,
          issueDate: row.issue_date,
          documentDate: row.document_date,
          totalValue: row.total_value,
          totalWeight: row.total_weight,
          items: row.items || [],
          isAssigned: row.is_assigned || false,
        }));

      const tl = (timelineByMap.get(m.id) || []).map((t: any) => ({
        id: t.id,
        timestamp: t.timestamp,
        status: t.status,
        description: t.description,
        userId: t.user_id,
        userName: t.user_name,
      }));

      return {
        id: m.id,
        code: m.code,
        carrierName: m.carrier_name || '',
        vehiclePlate: m.vehicle_plate || '',
        sourceCity: m.source_city || '',
        route: m.route || '',
        googleMapsLink: m.google_maps_link || '',
        status: m.status,
        currentCity: m.current_city || '',
        logisticsNotes: m.logistics_notes || '',
        invoices: invs,
        timeline: tl,
      };
    });
  } catch (error) {
    console.error('Erro ao carregar mapas:', error);
    return [];
  }
}

export async function deleteLoadMapFromDatabase(mapId: string): Promise<void> {
  try {
    await supabase.from('load_map_invoices').delete().eq('load_map_id', mapId);
    await supabase.from('load_map_timeline').delete().eq('load_map_id', mapId);
    const { error } = await supabase.from('load_maps').delete().eq('id', mapId);
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar mapa:', error);
    throw error;
  }
}