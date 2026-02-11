import { supabase } from './supabase';

export interface SyncConfig {
  id: string;
  last_sync_date: string | null;
  page_size: number;
  delay_between_pages_ms: number;
  max_concurrent_pages: number;
  request_timeout_ms: number;
  updated_at: string;
  created_at: string;
}

export interface SyncHistory {
  id: string;
  sync_type: 'full' | 'incremental';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  total_pages: number;
  total_invoices: number;
  error_message: string | null;
  created_at: string;
}

export const getSyncConfig = async (): Promise<SyncConfig> => {
  const { data, error } = await supabase
    .from('sync_config')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching sync config:', error);
    return {
      id: '',
      last_sync_date: null,
      page_size: 100,
      delay_between_pages_ms: 500,
      max_concurrent_pages: 3,
      request_timeout_ms: 30000,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  if (!data) {
    const { data: newConfig, error: insertError } = await supabase
      .from('sync_config')
      .insert({
        page_size: 100,
        delay_between_pages_ms: 500,
        max_concurrent_pages: 3,
        request_timeout_ms: 30000,
      })
      .select()
      .single();

    if (insertError || !newConfig) {
      throw new Error('Failed to create sync config');
    }

    return newConfig;
  }

  return data;
};

export const updateLastSyncDate = async (date: string): Promise<void> => {
  const config = await getSyncConfig();

  const { error } = await supabase
    .from('sync_config')
    .update({ last_sync_date: date, updated_at: new Date().toISOString() })
    .eq('id', config.id);

  if (error) {
    console.error('Error updating last sync date:', error);
    throw error;
  }
};

export const createSyncHistory = async (syncType: 'full' | 'incremental'): Promise<string> => {
  const { data, error } = await supabase
    .from('sync_history')
    .insert({
      sync_type: syncType,
      status: 'running',
      total_pages: 0,
      total_invoices: 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating sync history:', error);
    throw new Error('Failed to create sync history');
  }

  return data.id;
};

export const updateSyncHistory = async (
  id: string,
  update: Partial<Omit<SyncHistory, 'id' | 'created_at'>>
): Promise<void> => {
  const { error } = await supabase
    .from('sync_history')
    .update(update)
    .eq('id', id);

  if (error) {
    console.error('Error updating sync history:', error);
    throw error;
  }
};

export const completeSyncHistory = async (
  id: string,
  totalPages: number,
  totalInvoices: number
): Promise<void> => {
  await updateSyncHistory(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    total_pages: totalPages,
    total_invoices: totalInvoices,
  });
};

export const failSyncHistory = async (id: string, errorMessage: string): Promise<void> => {
  await updateSyncHistory(id, {
    status: 'failed',
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  });
};

export const getRecentSyncHistory = async (limit: number = 10): Promise<SyncHistory[]> => {
  const { data, error } = await supabase
    .from('sync_history')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching sync history:', error);
    return [];
  }

  return data || [];
};
