import { Invoice } from '../types';

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

export const fetchErpInvoices = async (baseUrl: string, apiKey: string): Promise<Invoice[]> => {
  if (!baseUrl) throw new Error("URL da API não configurada.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/erp-proxy`;

  console.log('🔄 Iniciando sincronização com ERP...');
  console.log('📍 URL do ERP:', baseUrl);
  console.log('🔗 Edge Function:', edgeFunctionUrl);

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ url: baseUrl })
    });

    console.log('📥 Resposta da Edge Function:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);

        if (response.status === 401) throw new Error("Não autorizado (401). Verifique a configuração do Supabase.");
        if (response.status === 404) throw new Error("Edge Function não encontrada (404).");
        if (response.status === 500) throw new Error(`Erro interno na Edge Function: ${errorText}`);
        throw new Error(`Erro na sincronização (${response.status}): ${errorText}`);
    }

    const apiResponse: ErpApiResponse = await response.json();
    console.log('✅ Dados recebidos:', apiResponse.data?.length || 0, 'itens');

    if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
      console.error('❌ Resposta da API inválida:', apiResponse);
      throw new Error('Resposta da API não contém dados válidos');
    }

    if (apiResponse.data.length === 0) {
      console.warn('⚠️ Nenhum dado retornado da API ERP');
      return [];
    }

    const invoicesMap = new Map<number, Invoice>();

    console.log('🔨 Processando', apiResponse.data.length, 'itens do ERP...');

    apiResponse.data.forEach((item: ErpApiItem) => {
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
          items: []
        });
      }

      const invoice = invoicesMap.get(invoiceId)!;

      invoice.items.push({
        sku: item.cod_item || 'N/A',
        description: item.descricao || 'Sem descrição',
        quantity: item.quantidade || 0,
        unit: item.unidade || 'UN',
        weightKg: item.quantidade_kgl || 0,
        quantityPicked: 0
      });

      invoice.totalValue += item.valor_liquido || 0;
      invoice.totalWeight += item.quantidade_kgl || 0;
    });

    const invoices = Array.from(invoicesMap.values()).map(inv => ({
      ...inv,
      totalValue: parseFloat(inv.totalValue.toFixed(2)),
      totalWeight: parseFloat(inv.totalWeight.toFixed(2))
    }));

    console.log('✅ Processadas', invoices.length, 'notas fiscais');
    return invoices;

  } catch (error) {
    console.error("❌ Falha na sincronização ERP:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Erro desconhecido na sincronização com ERP');
  }
};