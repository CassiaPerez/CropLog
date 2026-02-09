import { supabase } from './supabase';
import { Invoice } from '../types';

// Tipagem auxiliar para o retorno do Supabase (Snake Case)
interface DbInvoiceItem {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  weight_kg: number;
  quantity_picked: number | null;
}

interface DbInvoice {
  id: string;
  number: string; // ou number, dependendo do seu DB
  customer_name: string;
  customer_city: string;
  issue_date: string;
  document_date: string;
  total_value: number;
  total_weight: number;
  is_assigned: boolean;
  created_at: string;
  // O Supabase retorna os itens aninhados aqui
  invoice_items: DbInvoiceItem[]; 
}

export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<void> {
  console.log(`💾 Salvando ${invoices.length} notas no banco de dados...`);
  
  let successCount = 0;
  let errorCount = 0;

  // Processamos uma por uma para garantir a integridade dos itens de cada nota
  for (const invoice of invoices) {
    try {
      // 1. UPSERT da Nota (Insere ou Atualiza baseado na coluna 'number')
      // IMPORTANTE: A coluna 'number' no banco deve ter uma constraint UNIQUE para isso funcionar perfeitamente sem duplicar.
      const { data: savedInvoice, error: upsertError } = await supabase
        .from('invoices')
        .upsert({
          number: invoice.number, // Chave de unicidade (se configurada no banco)
          customer_name: invoice.customerName,
          customer_city: invoice.customerCity,
          issue_date: invoice.issueDate,
          document_date: invoice.documentDate,
          total_value: invoice.totalValue,
          total_weight: invoice.totalWeight,
          is_assigned: invoice.isAssigned || false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'number' }) // Garante que usa o número da nota para identificar duplicidade
        .select()
        .single();

      if (upsertError) throw upsertError;
      if (!savedInvoice) throw new Error(`Falha ao salvar cabeçalho da nota ${invoice.number}`);

      // 2. Substituição dos Itens (Estratégia: Delete All + Insert All)
      // Primeiro limpamos os itens antigos dessa nota para evitar duplicidade ou itens órfãos
      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', savedInvoice.id);

      if (deleteError) throw deleteError;

      // Prepara os novos itens
      const itemsToInsert = invoice.items.map(item => ({
        invoice_id: savedInvoice.id,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        weight_kg: item.weightKg,
        quantity_picked: item.quantityPicked || null
      }));

      if (itemsToInsert.length > 0) {
        const { error: insertItemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
          
        if (insertItemsError) throw insertItemsError;
      }

      successCount++;

    } catch (error: any) {
      console.error(`❌ Erro na nota ${invoice.number}:`, error.message);
      errorCount++;
    }
  }

  console.log('📊 Resumo:', { Sucesso: successCount, Erros: errorCount });

  if (errorCount > 0 && successCount === 0) {
    throw new Error(`Falha total: ${errorCount} notas não puderam ser salvas.`);
  }
}

export async function loadInvoicesFromDatabase(): Promise<Invoice[]> {
  try {
    console.log('🔄 Buscando notas e itens (Query otimizada)...');
    
    // QUERY OTIMIZADA: Traz Notas E Itens em uma única chamada de rede
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro no Supabase:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    console.log(`✅ Carregadas ${data.length} notas.`);

    // Mapeamento do formato do Banco (Snake_Case) para o App (CamelCase)
    // O Supabase retorna 'invoice_items' como um array dentro de cada invoice
    const invoices: Invoice[] = data.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer_name,
      customerCity: inv.customer_city,
      issueDate: inv.issue_date,
      documentDate: inv.document_date,
      totalValue: Number(inv.total_value),
      totalWeight: Number(inv.total_weight),
      isAssigned: inv.is_assigned,
      items: (inv.invoice_items || []).map((item: any) => ({
        sku: item.sku,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        weightKg: Number(item.weight_kg),
        quantityPicked: item.quantity_picked ? Number(item.quantity_picked) : 0
      }))
    }));

    return invoices;

  } catch (error) {
    console.error('❌ Erro crítico ao carregar:', error);
    return [];
  }
}

export async function updateInvoiceAssignedStatus(invoiceIds: string[], isAssigned: boolean): Promise<void> {
  // Esta função já estava eficiente, mantive a lógica
  const { error } = await supabase
    .from('invoices')
    .update({ 
      is_assigned: isAssigned, 
      updated_at: new Date().toISOString() 
    })
    .in('id', invoiceIds);

  if (error) {
    console.error('Erro ao atualizar status:', error);
    throw error;
  }
}