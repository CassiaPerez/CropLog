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

  const supabaseUrl = import.meta.env.REACT_APP_SUPABASE_URL || 'https://elxtwxyuukmiiksiqmpr.supabase.co';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/erp-proxy`;

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: baseUrl })
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error("Não autorizado (401). Verifique a API Key.");
        if (response.status === 404) throw new Error("Endpoint não encontrado (404).");
        throw new Error(`Erro na API: ${response.statusText}`);
    }

    const apiResponse: ErpApiResponse = await response.json();

    const invoicesMap = new Map<number, Invoice>();

    apiResponse.data.forEach((item: ErpApiItem) => {
      const invoiceId = item.nr_docto;

      if (!invoicesMap.has(invoiceId)) {
        invoicesMap.set(invoiceId, {
          id: `nf-${item.cod_empresa}-${invoiceId}`,
          number: `${invoiceId}`,
          customerName: item.nome_pessoa,
          customerCity: `${item.cidade_pessoa} - ${item.uf_pessoa}`,
          issueDate: item.data_dcto.split('T')[0],
          totalValue: 0,
          totalWeight: 0,
          isAssigned: false,
          items: []
        });
      }

      const invoice = invoicesMap.get(invoiceId)!;

      invoice.items.push({
        sku: item.cod_item,
        description: item.descricao,
        quantity: item.quantidade,
        unit: item.unidade,
        weightKg: item.quantidade_kgl,
        quantityPicked: 0
      });

      invoice.totalValue += item.valor_liquido;
      invoice.totalWeight += item.quantidade_kgl;
    });

    return Array.from(invoicesMap.values()).map(inv => ({
      ...inv,
      totalValue: parseFloat(inv.totalValue.toFixed(2)),
      totalWeight: parseFloat(inv.totalWeight.toFixed(2))
    }));

  } catch (error) {
    console.error("ERP Sync Failed:", error);
    throw error;
  }
};