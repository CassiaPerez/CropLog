import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Key, CheckCircle, XCircle, Loader, Save, RefreshCw, Clock } from 'lucide-react';
import {
  ApiConfig,
  getActiveConfig,
  createConfig,
  updateConfig,
  testConnection,
  updateTestStatus,
  getOrCreateDefaultConfig,
} from '../services/apiConfigService';

interface ApiConfigPanelProps {
  onConfigSaved?: () => void;
}

export const ApiConfigPanel: React.FC<ApiConfigPanelProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [formData, setFormData] = useState({
    name: 'Configuração Principal',
    base_url: '',
    api_key: '',
    auto_sync_enabled: false,
    sync_interval_minutes: 5,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, name: e.target.value }));
  }, []);

  const handleBaseUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, base_url: e.target.value }));
  }, []);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, api_key: e.target.value }));
  }, []);

  const handleAutoSyncToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, auto_sync_enabled: e.target.checked }));
  }, []);

  const handleSyncIntervalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, sync_interval_minutes: parseInt(e.target.value) || 5 }));
  }, []);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const activeConfig = await getOrCreateDefaultConfig();
      if (activeConfig) {
        setConfig(activeConfig);
        setFormData({
          name: activeConfig.name,
          base_url: activeConfig.base_url,
          api_key: activeConfig.api_key || '',
          auto_sync_enabled: activeConfig.auto_sync_enabled,
          sync_interval_minutes: activeConfig.sync_interval_minutes,
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.base_url.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, insira a URL da API antes de testar',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(formData.base_url);
      setTestResult(result);

      if (config) {
        await updateTestStatus(config.id, result.success, result.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao testar conexão',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.base_url.trim()) {
      alert('Por favor, insira a URL da API');
      return;
    }

    setIsSaving(true);
    try {
      if (config) {
        await updateConfig(config.id, {
          ...formData,
          is_active: true,
        });
      } else {
        await createConfig({
          ...formData,
          is_active: true,
        });
      }

      await loadConfig();
      setTestResult({
        success: true,
        message: 'Configuração salva com sucesso!',
      });

      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao salvar configuração',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">
          Nome da Configuração
        </label>
        <div className="relative">
          <input
            value={formData.name}
            onChange={handleNameChange}
            type="text"
            className="w-full pl-14 pr-4 py-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
            placeholder="Configuração Principal"
          />
          <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-text-light" size={24} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">
          URL da API ERP
        </label>
        <div className="relative">
          <input
            value={formData.base_url}
            onChange={handleBaseUrlChange}
            type="text"
            className="w-full pl-14 pr-4 py-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
            placeholder="https://api.erp.com/api/Faturamento_Backlog_Wonder?..."
          />
          <Globe className="absolute left-5 top-1/2 -translate-y-1/2 text-text-light" size={24} />
        </div>
        <p className="text-sm text-text-light pl-2">
          Insira a URL completa da API incluindo todos os parâmetros necessários
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-lg font-bold text-text-secondary uppercase tracking-wide">
          API Key (Opcional)
        </label>
        <div className="relative">
          <input
            value={formData.api_key}
            onChange={handleApiKeyChange}
            type="password"
            className="w-full pl-14 pr-4 py-4 bg-background rounded-2xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
            placeholder="a4d8c7f12e3b4c9a9f6e9e2a1b4d7c8f..."
          />
          <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-text-light" size={24} />
        </div>
      </div>

      <div className="bg-background p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-text-secondary uppercase tracking-wide">
          Sincronização Automática
        </h3>

        <label className="flex items-center gap-4 cursor-pointer group">
          <input
            type="checkbox"
            checked={formData.auto_sync_enabled}
            onChange={handleAutoSyncToggle}
            className="w-6 h-6 rounded border-2 border-text-light checked:bg-primary checked:border-primary cursor-pointer transition-all"
          />
          <span className="text-lg font-medium group-hover:text-primary transition-colors">
            Habilitar sincronização automática
          </span>
        </label>

        {formData.auto_sync_enabled && (
          <div className="space-y-2 ml-10">
            <label className="text-sm font-bold text-text-light uppercase tracking-wide flex items-center gap-2">
              <Clock size={16} />
              Intervalo entre sincronizações
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                max="60"
                value={formData.sync_interval_minutes}
                onChange={handleSyncIntervalChange}
                className="w-24 px-4 py-2 bg-white rounded-xl border-2 border-transparent focus:border-primary/20 text-lg font-medium outline-none transition-all"
              />
              <span className="text-text-secondary font-medium">minutos</span>
            </div>
          </div>
        )}
      </div>

      {testResult && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-4 ${
            testResult.success
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-red-50 border-2 border-red-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="text-green-600" size={24} />
          ) : (
            <XCircle className="text-red-600" size={24} />
          )}
          <p className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {testResult.message}
          </p>
        </div>
      )}

      {config?.last_test_at && (
        <div className="text-sm text-text-light pl-2">
          Último teste: {new Date(config.last_test_at).toLocaleString('pt-BR')} -{' '}
          <span className={config.last_test_status === 'success' ? 'text-green-600' : 'text-red-600'}>
            {config.last_test_status === 'success' ? 'Sucesso' : 'Falhou'}
          </span>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={handleTestConnection}
          disabled={isTesting}
          className="flex-1 flex items-center justify-center gap-3 py-5 px-6 bg-white hover:bg-gray-50 text-text-primary rounded-2xl font-bold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? (
            <>
              <Loader className="animate-spin" size={24} />
              Testando...
            </>
          ) : (
            <>
              <RefreshCw size={24} />
              Testar Conexão
            </>
          )}
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-3 py-5 px-6 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader className="animate-spin" size={24} />
              Salvando...
            </>
          ) : (
            <>
              <Save size={24} />
              Salvar Configuração
            </>
          )}
        </button>
      </div>
    </div>
  );
};
