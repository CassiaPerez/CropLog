import { supabase } from './supabase';
import { serializeError, logError } from '../utils/errorUtils';

export interface ApiConfig {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  is_active: boolean;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  last_test_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiConfigInput {
  name: string;
  base_url: string;
  api_key?: string;
  is_active?: boolean;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

export async function getActiveConfig(): Promise<ApiConfig | null> {
  try {
    const { data, error } = await supabase
      .from('api_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    logError('Error fetching active API config', error);
    return null;
  }
}

export async function getAllConfigs(): Promise<ApiConfig[]> {
  try {
    const { data, error } = await supabase
      .from('api_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logError('Error fetching API configs', error);
    return [];
  }
}

export async function createConfig(input: ApiConfigInput): Promise<ApiConfig> {
  try {
    if (input.is_active) {
      await deactivateAllConfigs();
    }

    const { data, error } = await supabase
      .from('api_config')
      .insert({
        name: input.name,
        base_url: input.base_url,
        api_key: input.api_key || null,
        is_active: input.is_active ?? false,
        auto_sync_enabled: input.auto_sync_enabled ?? false,
        sync_interval_minutes: input.sync_interval_minutes ?? 5,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logError('Error creating API config', error);
    throw new Error(serializeError(error));
  }
}

export async function updateConfig(id: string, input: Partial<ApiConfigInput>): Promise<ApiConfig> {
  try {
    if (input.is_active) {
      await deactivateAllConfigs();
    }

    const { data, error } = await supabase
      .from('api_config')
      .update({
        ...(input.name && { name: input.name }),
        ...(input.base_url && { base_url: input.base_url }),
        ...(input.api_key !== undefined && { api_key: input.api_key || null }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        ...(input.auto_sync_enabled !== undefined && { auto_sync_enabled: input.auto_sync_enabled }),
        ...(input.sync_interval_minutes && { sync_interval_minutes: input.sync_interval_minutes }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logError('Error updating API config', error);
    throw new Error(serializeError(error));
  }
}

export async function deleteConfig(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_config')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    logError('Error deleting API config', error);
    throw new Error(serializeError(error));
  }
}

export async function setActiveConfig(id: string): Promise<void> {
  try {
    await deactivateAllConfigs();

    const { error } = await supabase
      .from('api_config')
      .update({ is_active: true })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    logError('Error setting active config', error);
    throw new Error(serializeError(error));
  }
}

export async function deactivateAllConfigs(): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_config')
      .update({ is_active: false })
      .eq('is_active', true);

    if (error) throw error;
  } catch (error) {
    logError('Error deactivating configs', error);
    throw new Error(serializeError(error));
  }
}

export async function testConnection(baseUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/erp-proxy`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        url: baseUrl,
        page: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Erro ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return {
        success: false,
        message: 'Resposta da API não contém dados válidos',
      };
    }

    return {
      success: true,
      message: `Conexão bem-sucedida! ${data.total || 0} registros encontrados.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Timeout: A API não respondeu em 10 segundos',
      };
    }
    return {
      success: false,
      message: `Erro ao testar conexão: ${serializeError(error)}`,
    };
  }
}

export async function updateTestStatus(id: string, success: boolean, message: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: success ? 'success' : 'failed',
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    logError('Error updating test status', error);
  }
}

export async function getOrCreateDefaultConfig(): Promise<ApiConfig | null> {
  const activeConfig = await getActiveConfig();
  if (activeConfig) return activeConfig;

  const allConfigs = await getAllConfigs();
  if (allConfigs.length > 0) {
    return allConfigs[0];
  }

  return null;
}
