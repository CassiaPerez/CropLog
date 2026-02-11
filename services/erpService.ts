import { Invoice } from '../types';
import {
  getSyncConfig,
  updateLastSyncDate,
  createSyncHistory,
  completeSyncHistory,
  failSyncHistory,
  updateSyncHistory,
} from './syncConfigService';

interface ErpApiItem {
  id_transacao: number;
  cod_empresa: number;
  id: string;
  data_dcto: string;
  data: string;
  especie_dcto: string;
  nr_docto: number;
  nro_pedido: string;
  dt_pedido: string;
  es: string;
  w_tp_trans: string;
  oper_estoque: string;
  w_id_pessoa_filial: number;
  cod_pessoa_filial: number;
  nome_pessoa: string;
  cidade_pessoa: string;
  uf_pessoa: string;
  cpf_cnpj: string;
  id_municipio: number;
  w_id_vendedor: number;
  cod_item: string;
  unidade: string;
  descricao: string;
  w_id_produto: number;
  cfop: string;
  quantidade: number;
  valor_liquido: number;
  vl_unitario: number;
  moeda: string;
  frete: number;
  bonificado: string;
  indice: number;
  cod_pagamento: string;
  fator_conv: number;
  und_alt: string;
  quantidade_kgl: number;
}

interface ErpApiResponse {
  relatorio: string;
  total: number;
  page: number;
  limit: number;
  data: ErpApiItem[];
}

export interface SyncProgress {
  currentPage: number;
  totalPages: number;
  processedInvoices: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchSinglePage = async (
  baseUrl: string,
  page: number,
  dateFrom?: string
): Promise<ErpApiResponse> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/erp-proxy`;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      url: baseUrl,
      page,
      dateFrom,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Não autorizado (401). Verifique a configuração do Supabase.");
    if (response.status === 404) throw new Error("Edge Function não encontrada (404).");
    if (response.status === 500) throw new Error(`Erro interno na Edge Function: ${errorText}`);
    throw new Error(`Erro na sincronização (${response.status}): ${errorText}`);
  }

  const apiResponse: ErpApiResponse = await response.json();

  if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
    throw new Error('Resposta da API não contém dados válidos');
  }

  return apiResponse;
};

export const fetchInvoiceByDocNumber = async (
  baseUrl: string,
  docNumber: number
): Promise<Invoice[]> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/erp-proxy`;

  const urlWithDocNumber = new URL(baseUrl);
  urlWithDocNumber.searchParams.delete('page');
  urlWithDocNumber.searchParams.delete('limit');
  urlWithDocNumber.searchParams.set('nr_docto', docNumber.toString());

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      url: urlWithDocNumber.toString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Não autorizado (401). Verifique a configuração do Supabase.");
    if (response.status === 404) throw new Error("Edge Function não encontrada (404).");
    if (response.status === 500) throw new Error(`Erro interno na Edge Function: ${errorText}`);
    throw new Error(`Erro ao buscar nota fiscal (${response.status}): ${errorText}`);
  }

  const apiResponse: ErpApiResponse = await response.json();

  if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
    throw new Error('Resposta da API não contém dados válidos');
  }

  return processErpItems(apiResponse.data);
};

const processErpItems = (items: ErpApiItem[]): Invoice[] => {
  const invoicesMap = new Map<number, Invoice>();

  items.forEach((item: ErpApiItem) => {
    const invoiceId = item.nr_docto;

    if (!invoiceId) {
      console.warn('⚠️ Item sem número de documento:', item);
      return;
    }

    if (!invoicesMap.has(invoiceId)) {
      invoicesMap.set(invoiceId, {
        id: `nf-${item.cod_empresa}-${invoiceId}`,
        number: `${invoiceId}`,
        customerName: item.nome_pessoa || 'Cliente não identificado',
        customerCity: `${item.cidade_pessoa || ''} - ${item.uf_pessoa || ''}`.trim(),
        issueDate: item.data_dcto?.split('T')[0] || new Date().toISOString().split('T')[0],
        documentDate: item.data_dcto?.split('T')[0] || new Date().toISOString().split('T')[0],
        totalValue: 0,
        totalWeight: 0,
        isAssigned: false,
        items: [],
      });
    }

    const invoice = invoicesMap.get(invoiceId)!;

    invoice.items.push({
      sku: item.cod_item || 'N/A',
      description: item.descricao || 'Sem descrição',
      quantity: item.quantidade || 0,
      unit: item.unidade || 'UN',
      weightKg: item.quantidade_kgl || 0,
      quantityPicked: 0,
    });

    invoice.totalValue += item.valor_liquido || 0;
    invoice.totalWeight += item.quantidade_kgl || 0;
  });

  return Array.from(invoicesMap.values()).map((inv) => ({
    ...inv,
    totalValue: parseFloat(inv.totalValue.toFixed(2)),
    totalWeight: parseFloat(inv.totalWeight.toFixed(2)),
  }));
};

export const fetchErpInvoices = async (
  baseUrl: string,
  apiKey: string,
  options?: {
    syncType?: 'full' | 'incremental';
    onProgress?: SyncProgressCallback;
    maxPages?: number;
  }
): Promise<Invoice[]> => {
  if (!baseUrl) throw new Error("URL da API não configurada.");

  const syncType = options?.syncType || 'full';
  const onProgress = options?.onProgress;
  const maxPages = options?.maxPages;

  console.log(`🔄 Iniciando sincronização ${syncType === 'full' ? 'COMPLETA' : 'INCREMENTAL'} com ERP...`);
  console.log('📍 URL do ERP:', baseUrl);

  let syncHistoryId: string | null = null;

  try {
    const config = await getSyncConfig();
    syncHistoryId = await createSyncHistory(syncType);

    const dateFrom = syncType === 'incremental' && config.last_sync_date
      ? config.last_sync_date
      : undefined;

    if (dateFrom) {
      console.log('📅 Sincronizando apenas notas desde:', dateFrom);
    }

    console.log('📥 Buscando primeira página para calcular total...');
    const firstPage = await fetchSinglePage(baseUrl, 1, dateFrom);

    const totalRecords = firstPage.total || 0;
    const limitPerPage = firstPage.limit || 100;
    const totalPages = Math.ceil(totalRecords / limitPerPage);
    const pagesToFetch = maxPages ? Math.min(totalPages, maxPages) : totalPages;

    console.log(`📊 Total de registros: ${totalRecords}`);
    console.log(`📄 Total de páginas: ${totalPages}`);
    console.log(`🎯 Páginas a buscar: ${pagesToFetch}`);

    if (totalRecords === 0) {
      console.warn('⚠️ Nenhum dado retornado da API ERP');
      await completeSyncHistory(syncHistoryId, 0, 0);
      return [];
    }

    const allItems: ErpApiItem[] = [...firstPage.data];
    let processedInvoices = processErpItems(firstPage.data).length;

    if (onProgress) {
      onProgress({
        currentPage: 1,
        totalPages: pagesToFetch,
        processedInvoices,
        percentage: (1 / pagesToFetch) * 100,
      });
    }

    await updateSyncHistory(syncHistoryId, {
      total_pages: 1,
      total_invoices: processedInvoices,
    });

    if (pagesToFetch > 1) {
      console.log(`🔄 Buscando páginas 2 a ${pagesToFetch}...`);

      for (let page = 2; page <= pagesToFetch; page++) {
        const startTime = Date.now();

        try {
          await delay(config.delay_between_pages_ms);

          const pageData = await fetchSinglePage(baseUrl, page, dateFrom);
          allItems.push(...pageData.data);

          const pageInvoices = processErpItems(pageData.data).length;
          processedInvoices += pageInvoices;

          const elapsedTime = Date.now() - startTime;
          const avgTimePerPage = elapsedTime / page;
          const remainingPages = pagesToFetch - page;
          const estimatedTimeRemaining = (avgTimePerPage * remainingPages) / 1000;

          console.log(`✅ Página ${page}/${pagesToFetch} processada (${pageInvoices} notas)`);

          if (onProgress) {
            onProgress({
              currentPage: page,
              totalPages: pagesToFetch,
              processedInvoices,
              percentage: (page / pagesToFetch) * 100,
              estimatedTimeRemaining,
            });
          }

          await updateSyncHistory(syncHistoryId, {
            total_pages: page,
            total_invoices: processedInvoices,
          });
        } catch (pageError) {
          console.error(`❌ Erro ao buscar página ${page}:`, pageError);
        }
      }
    }

    console.log('🔨 Processando todos os itens...');
    const invoices = processErpItems(allItems);

    await completeSyncHistory(syncHistoryId, pagesToFetch, invoices.length);
    await updateLastSyncDate(new Date().toISOString());

    console.log(`✅ Sincronização concluída: ${invoices.length} notas fiscais`);
    return invoices;
  } catch (error) {
    console.error("❌ Falha na sincronização ERP:", error?.message || String(error));

    if (syncHistoryId) {
      await failSyncHistory(
        syncHistoryId,
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Erro desconhecido na sincronização com ERP');
  }
};