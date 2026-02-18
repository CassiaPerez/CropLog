import { Invoice } from '../types';
import {
  getSyncConfig,
  updateLastSyncDate,
  createSyncHistory,
  completeSyncHistory,
  failSyncHistory,
  updateSyncHistory,
} from './syncConfigService';
import { serializeError, logError } from '../utils/errorUtils';
import { supabase } from './supabase';
import { getApiItems, getApiTotal, getApiLimit, getApiTotalExplicit } from '../utils/apiParsingUtils';
import { generateSHA256Hash } from '../utils/hashUtils';

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
  totalExplicit: number | null;
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
  newInvoices?: number;
  updatedInvoices?: number;
  unchangedInvoices?: number;
  cancelledInvoices?: number;
  status?: string;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Tentativa ${attempt + 1}/${maxRetries} falhou, tentando novamente em ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

const fetchSinglePage = async (
  baseUrl: string,
  page: number
): Promise<ErpApiResponse> => {
  return fetchWithRetry(async () => {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error("Não autorizado (401). Verifique a configuração do Supabase.");
      if (response.status === 404) throw new Error("Edge Function não encontrada (404).");
      if (response.status === 500) throw new Error(`Erro interno na Edge Function: ${errorText}`);
      throw new Error(`Erro na sincronização (${response.status}): ${errorText}`);
    }

    const apiResponse: any = await response.json();

    const items = getApiItems(apiResponse);
    const total = getApiTotal(apiResponse);
    const totalExplicit = getApiTotalExplicit(apiResponse);
    const limit = getApiLimit(apiResponse, 100);

    const normalizedResponse: ErpApiResponse = {
      relatorio: apiResponse.relatorio || 'sync',
      total: total,
      totalExplicit: totalExplicit,
      page: apiResponse.page || page,
      limit: limit,
      data: items
    };

    return normalizedResponse;
  }, 3, 1000);
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

  const apiResponse: any = await response.json();

  const items = getApiItems(apiResponse);

  if (items.length === 0) {
    throw new Error('Nenhuma nota fiscal encontrada com esse número');
  }

  return processErpItems(items);
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

async function getExistingInvoiceHashes(): Promise<Map<string, { hash: string; lastSync: string }>> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('number, source_hash, erp_data_hash, last_synced_at');

  const hashMap = new Map<string, { hash: string; lastSync: string }>();
  invoices?.forEach(inv => {
    const hash = inv.source_hash || inv.erp_data_hash;
    if (hash) {
      hashMap.set(inv.number, {
        hash: hash,
        lastSync: inv.last_synced_at || ''
      });
    }
  });

  return hashMap;
}

async function createInvoiceHash(invoice: Invoice): Promise<string> {
  const data = {
    customerName: invoice.customerName,
    customerCity: invoice.customerCity,
    totalValue: invoice.totalValue.toFixed(2),
    totalWeight: invoice.totalWeight.toFixed(3),
    itemsCount: invoice.items.length,
    items: invoice.items.map(i => ({
      sku: i.sku,
      quantity: i.quantity,
      weightKg: i.weightKg.toFixed(3)
    }))
  };
  return await generateSHA256Hash(data);
}

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
  const allInvoices: Invoice[] = [];
  let stats = {
    newInvoices: 0,
    updatedInvoices: 0,
    unchangedInvoices: 0,
    cancelledInvoices: 0
  };

  try {
    const config = await getSyncConfig();
    syncHistoryId = await createSyncHistory(syncType);

    const existingHashes = await getExistingInvoiceHashes();
    console.log(`📊 ${existingHashes.size} notas já existem no banco`);

    if (onProgress) {
      onProgress({
        currentPage: 0,
        totalPages: 0,
        processedInvoices: 0,
        percentage: 0,
        status: 'Buscando informações da API...',
        ...stats
      });
    }

    console.log('📥 Buscando primeira página...');
    const firstPage = await fetchSinglePage(baseUrl, 1);

    const totalRecordsExplicit = firstPage.totalExplicit;
    const limitPerPage = firstPage.limit || 100;
    const firstPageItemCount = firstPage.data.length;

    const totalKnown = totalRecordsExplicit !== null && totalRecordsExplicit > 0;
    const totalRecords = totalKnown ? totalRecordsExplicit! : 0;
    const totalPages = totalKnown ? Math.ceil(totalRecords / limitPerPage) : null;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 INFORMAÇÕES DA API`);
    console.log(`${'='.repeat(60)}`);
    if (totalKnown) {
      console.log(`📦 Total de registros na API: ${totalRecords.toLocaleString()}`);
      console.log(`📄 Limite por página: ${limitPerPage.toLocaleString()} registros`);
      console.log(`📖 Total de páginas: ${totalPages}`);
    } else {
      console.log(`📦 Total de registros: desconhecido (API não retornou campo total)`);
      console.log(`📄 Limite por página: ${limitPerPage.toLocaleString()} registros`);
      console.log(`📖 Modo: busca contínua até página vazia`);
    }
    console.log(`${'='.repeat(60)}\n`);

    if (firstPageItemCount === 0) {
      console.warn('Nenhum dado retornado da API ERP');
      await completeSyncHistory(syncHistoryId, 0, 0);
      return [];
    }

    let pageInvoices = processErpItems(firstPage.data);

    for (const invoice of pageInvoices) {
      const hash = await createInvoiceHash(invoice);
      const existing = existingHashes.get(invoice.number);

      if (!existing) {
        stats.newInvoices++;
      } else if (existing.hash !== hash) {
        stats.updatedInvoices++;
      } else {
        stats.unchangedInvoices++;
      }
    }

    allInvoices.push(...pageInvoices);

    if (onProgress) {
      onProgress({
        currentPage: 1,
        totalPages: totalPages ?? 0,
        processedInvoices: pageInvoices.length,
        percentage: totalPages ? (1 / totalPages) * 100 : 0,
        status: 'Processando páginas...',
        ...stats
      });
    }

    await updateSyncHistory(syncHistoryId, {
      total_pages: 1,
      total_invoices: pageInvoices.length,
    });

    if (syncType === 'incremental') {
      console.log('🎯 Modo incremental: buscando até encontrar notas já sincronizadas');
    }

    let page = 2;
    let consecutiveUnchanged = 0;
    const maxConsecutiveUnchanged = syncType === 'incremental' ? 50 : Infinity;
    const pagesToFetch = totalPages
      ? (maxPages ? Math.min(totalPages, maxPages) : totalPages)
      : (maxPages ?? Number.MAX_SAFE_INTEGER);
    const startTime = Date.now();

    while (page <= pagesToFetch) {
      try {
        await delay(config.delay_between_pages_ms);

        if (onProgress) {
          onProgress({
            currentPage: page - 1,
            totalPages: totalPages ?? 0,
            processedInvoices: allInvoices.length,
            percentage: totalPages ? ((page - 1) / totalPages) * 100 : 0,
            status: `Buscando página ${page}${totalPages ? `/${totalPages}` : ''}...`,
            ...stats
          });
        }

        const pageData = await fetchSinglePage(baseUrl, page);
        pageInvoices = processErpItems(pageData.data);

        if (pageData.data.length === 0) {
          console.log(`Página ${page} vazia — fim da paginação`);
          break;
        }

        let pageHasChanges = false;
        for (const invoice of pageInvoices) {
          const hash = await createInvoiceHash(invoice);
          const existing = existingHashes.get(invoice.number);

          if (!existing) {
            stats.newInvoices++;
            pageHasChanges = true;
          } else if (existing.hash !== hash) {
            stats.updatedInvoices++;
            pageHasChanges = true;
          } else {
            stats.unchangedInvoices++;
          }
        }

        allInvoices.push(...pageInvoices);

        if (!pageHasChanges && syncType === 'incremental') {
          consecutiveUnchanged++;
          console.log(`Página ${page}: sem alterações (${consecutiveUnchanged}/${maxConsecutiveUnchanged})`);

          if (consecutiveUnchanged >= maxConsecutiveUnchanged) {
            console.log(`Early stopping: ${consecutiveUnchanged} páginas consecutivas sem mudanças`);
            break;
          }
        } else {
          consecutiveUnchanged = 0;
          console.log(`Página ${page}${totalPages ? `/${totalPages}` : ''}: ${pageInvoices.length} notas processadas`);
        }

        const elapsedTime = Date.now() - startTime;
        const avgTimePerPage = elapsedTime / (page - 1);
        const estimatedTimeRemaining = totalPages
          ? (avgTimePerPage * (totalPages - page)) / 1000
          : undefined;

        if (onProgress) {
          onProgress({
            currentPage: page,
            totalPages: totalPages ?? 0,
            processedInvoices: allInvoices.length,
            percentage: totalPages ? (page / totalPages) * 100 : 0,
            estimatedTimeRemaining,
            status: 'Processando...',
            ...stats
          });
        }

        await updateSyncHistory(syncHistoryId, {
          total_pages: page,
          total_invoices: allInvoices.length,
        });

        page++;
      } catch (pageError) {
        console.error(`Erro ao buscar página ${page}:`, pageError);
        page++;
      }
    }

    const finalPageCount = page - 1;
    const knownTotal = totalPages ?? finalPageCount;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULTADO DA SINCRONIZAÇÃO ${syncType.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Páginas processadas: ${finalPageCount}${totalPages ? `/${totalPages}` : ''}`);
    console.log(`Total de notas encontradas: ${allInvoices.length}`);
    console.log(`Novas: ${stats.newInvoices} | Atualizadas: ${stats.updatedInvoices} | Inalteradas: ${stats.unchangedInvoices}`);
    console.log(`${'='.repeat(60)}\n`);

    if (onProgress) {
      onProgress({
        currentPage: finalPageCount,
        totalPages: knownTotal,
        processedInvoices: allInvoices.length,
        percentage: 100,
        status: 'Salvando no banco de dados...',
        ...stats
      });
    }

    await completeSyncHistory(syncHistoryId, finalPageCount, allInvoices.length);
    await updateLastSyncDate(new Date().toISOString());

    console.log(`✅ Sincronização concluída: ${allInvoices.length} notas fiscais`);
    return allInvoices;
  } catch (error) {
    const errorMessage = serializeError(error);
    logError("Falha na sincronização ERP", error);

    if (syncHistoryId) {
      await failSyncHistory(syncHistoryId, errorMessage);
    }

    throw new Error(errorMessage);
  }
};