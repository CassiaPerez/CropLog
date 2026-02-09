import { supabase } from './supabase';
import { Invoice } from '../types';

// Função auxiliar para comparar se a nota mudou (evita gravação desnecessária)
function hasInvoiceChanged(newInv: Invoice, oldInv: any): boolean {
  if (!oldInv) return true; // Se não existe, é nova -> Salvar

  // Compara valores críticos (adicione mais campos se necessário)
  const isValueDiff = Math.abs(newInv.totalValue - oldInv.total_value) > 0.01;
  const isWeightDiff = Math.abs(newInv.totalWeight - oldInv.total_weight) > 0.001;
  const isDateDiff = newInv.issueDate !== oldInv.issue_date;
  const isCustomerDiff = newInv.customerName !== oldInv.customer_name;
  
  // Opcional: Se quiser ser muito preciso, compare a quantidade de itens
  // const isItemCountDiff = newInv.items.length !== oldInv.invoice_items.length;

  return isValueDiff || isWeightDiff || isDateDiff || isCustomerDiff;
}

export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<void> {
  if (invoices.length === 0) return;

  console.log(`🚀 Iniciando sincronização inteligente de ${invoices.length} notas...`);
  const startTime = performance.now();

  // 1. CRUCIAL: Excluir notas que não vieram na API (Canceladas ou fora do filtro)
  // Pegamos todos os números de notas que vieram da API
  const apiInvoiceNumbers = invoices.map(inv => inv.number);

  // Deletamos do banco tudo que NÃO estiver nessa lista
  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .not('number', 'in', `(${apiInvoiceNumbers.join(',')})`); // Filtro "NOT IN"

  if (deleteError) {
    console.error('Erro ao excluir notas canceladas:', deleteError);
  } else {
    console.log('🗑️ Limpeza de notas canceladas concluída.');
  }

  // 2. Buscar dados atuais do banco para comparar (Cache local para evitar N+1)
  // Trazemos apenas colunas necessárias para comparação
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('id, number, total_value, total_weight, issue_date, customer_name, invoice_items(count)')
    .in('number', apiInvoiceNumbers);

  const existingMap = new Map();
  existingInvoices?.forEach(inv => existingMap.set(inv.number, inv));

  // 3. Filtrar apenas o que precisa ser salvo
  const invoicesToSave = invoices.filter(invoice => {
    const oldInvoice = existingMap.get(invoice.number);
    const changed = hasInvoiceChanged(invoice, oldInvoice);
    if (!changed) {
      // console.log(`⏭️ Pulan nota ${invoice.number} (sem alterações)`);
    }
    return changed;
  });

  console.log(`💾 Processando: ${invoicesToSave.length} notas alteradas/novas (de ${invoices.length} totais).`);

  if (invoicesToSave.length === 0) {
    console.log('✅ Nenhuma alteração necessária.');
    return;
  }

  // 4. Processamento em Lotes (Batch) com Paralelismo Limitado
  // Processamos 10 notas simultaneamente para não sobrecarregar o banco
  const BATCH_SIZE = 10; 
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < invoicesToSave.length; i += BATCH_SIZE) {
    const chunk = invoicesToSave.slice(i, i + BATCH_SIZE);
    
    // Promise.all processa o lote em paralelo
    await Promise.all(chunk.map(async (invoice) => {
      try {
        // A. Upsert do Cabeçalho
        const { data: savedInvoice, error: upsertError } = await supabase
          .from('invoices')
          .upsert({
            number: invoice.number,
            customer_name: invoice.customerName,
            customer_city: invoice.customerCity,
            issue_date: invoice.issueDate,
            document_date: invoice.documentDate,
            total_value: invoice.totalValue,
            total_weight: invoice.totalWeight,
            is_assigned: invoice.isAssigned || false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'number' })
          .select('id')
          .single();

        if (upsertError) throw upsertError;

        // B. Substituição dos Itens (Delete + Insert é mais seguro para consistência)
        // Primeiro remove itens antigos dessa nota
        await supabase.from('invoice_items').delete().eq('invoice_id', savedInvoice.id);

        // Insere os novos
        const itemsToInsert = invoice.items.map(item => ({
          invoice_id: savedInvoice.id,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          weight_kg: item.weightKg,
          quantity_picked: item.quantityPicked
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        successCount++;
      } catch (err) {
        console.error(`❌ Falha na nota ${invoice.number}:`, err);
        errorCount++;
      }
    }));
    
    // Pequeno log de progresso
    console.log(`⏳ Processado lote ${i + chunk.length}/${invoicesToSave.length}`);
  }

  const endTime = performance.now();
  console.log(`✨ Sincronização finalizada em ${((endTime - startTime) / 1000).toFixed(2)}s`);
  console.log(`✅ Salvas: ${successCount} | ❌ Erros: ${errorCount} | ⏭️ Puladas: ${invoices.length - invoicesToSave.length}`);
}