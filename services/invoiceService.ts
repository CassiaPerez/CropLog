import { supabase } from './supabase';
import { Invoice } from '../types';

function createInvoiceHash(invoice: Invoice): string {
  const data = {
    customerName: invoice.customerName,
    customerCity: invoice.customerCity,
    totalValue: invoice.totalValue.toFixed(2),
    totalWeight: invoice.totalWeight.toFixed(3),
    itemsCount: invoice.items.length,
    itemsHash: invoice.items
      .map(i => `${i.sku}:${i.quantity}:${i.weightKg}`)
      .sort()
      .join('|')
  };
  return btoa(JSON.stringify(data));
}

function hasInvoiceChanged(newInv: Invoice, oldInv: any): boolean {
  if (!oldInv) return true;

  if (oldInv.erp_data_hash) {
    const newHash = createInvoiceHash(newInv);
    return newHash !== oldInv.erp_data_hash;
  }

  const isValueDiff = Math.abs(newInv.totalValue - oldInv.total_value) > 0.01;
  const isWeightDiff = Math.abs(newInv.totalWeight - oldInv.total_weight) > 0.001;
  const isDateDiff = newInv.issueDate !== oldInv.issue_date;
  const isCustomerDiff = newInv.customerName !== oldInv.customer_name;

  return isValueDiff || isWeightDiff || isDateDiff || isCustomerDiff;
}

export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<void> {
  if (invoices.length === 0) return;

  console.log(`🚀 Iniciando sincronização inteligente de ${invoices.length} notas...`);
  const startTime = performance.now();

  const apiInvoiceNumbers = invoices.map(inv => inv.number);

  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, number, total_value, total_weight, issue_date, customer_name, erp_data_hash, is_assigned, is_cancelled');

  const toCancel = (allInvoices || []).filter(
    inv => !apiInvoiceNumbers.includes(inv.number) && !inv.is_assigned && !inv.is_cancelled
  );

  if (toCancel.length > 0) {
    console.log(`🚫 Marcando ${toCancel.length} notas como canceladas...`);
    const idsToCancel = toCancel.map(inv => inv.id);

    const { error: cancelError } = await supabase
      .from('invoices')
      .update({
        is_cancelled: true,
        last_modified_at: new Date().toISOString()
      })
      .in('id', idsToCancel);

    if (cancelError) {
      console.error('❌ Erro ao marcar notas como canceladas:', cancelError);
    } else {
      console.log(`✅ ${toCancel.length} notas marcadas como canceladas`);
    }
  }

  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('id, number, total_value, total_weight, issue_date, customer_name, erp_data_hash, is_cancelled')
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
    
    await Promise.all(chunk.map(async (invoice) => {
      try {
        const hash = createInvoiceHash(invoice);
        const oldInvoice = existingMap.get(invoice.number);
        const isModified = oldInvoice && hasInvoiceChanged(invoice, oldInvoice);
        const wasReactivated = oldInvoice?.is_cancelled;
        const invoiceId = oldInvoice?.id || crypto.randomUUID();

        const { error: upsertError } = await supabase
          .from('invoices')
          .upsert({
            id: invoiceId,
            number: invoice.number,
            customer_name: invoice.customerName,
            customer_city: invoice.customerCity,
            issue_date: invoice.issueDate,
            document_date: invoice.documentDate,
            total_value: invoice.totalValue,
            total_weight: invoice.totalWeight,
            is_assigned: invoice.isAssigned || false,
            erp_data_hash: hash,
            api_hash: hash,
            is_modified: isModified ? true : false,
            is_cancelled: false,
            last_modified_at: (isModified || wasReactivated) ? new Date().toISOString() : undefined,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'number' });

        if (upsertError) throw upsertError;

        await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

        // Insere os novos
        const itemsToInsert = invoice.items.map(item => ({
          invoice_id: invoiceId,
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
        console.error(`❌ Falha na nota ${invoice.number}:`, err?.message || String(err));
        errorCount++;
      }
    }));
    
    // Pequeno log de progresso
    console.log(`⏳ Processado lote ${i + chunk.length}/${invoicesToSave.length}`);
  }

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const skipped = invoices.length - invoicesToSave.length;

  console.log(`\n✨ Sincronização finalizada em ${duration}s`);
  console.log(`📊 Resumo:`);
  console.log(`  ✅ Salvas/Atualizadas: ${successCount}`);
  console.log(`  ⏭️ Sem mudanças: ${skipped}`);
  console.log(`  🚫 Canceladas: ${toCancel.length}`);
  console.log(`  ❌ Erros: ${errorCount}`);
  console.log(`  📦 Total processado: ${invoices.length} notas\n`);

  if (errorCount > 0) {
    throw new Error(`Sincronização concluída com ${errorCount} erro(s)`);
  }
}

export async function loadInvoicesFromDatabase(): Promise<Invoice[]> {
  try {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (
          id,
          sku,
          description,
          quantity,
          unit,
          weight_kg,
          quantity_picked
        )
      `)
      .eq('is_cancelled', false)
      .order('document_date', { ascending: false });

    if (error) throw error;

    return (invoices || []).map(inv => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer_name,
      customerCity: inv.customer_city,
      issueDate: inv.issue_date,
      documentDate: inv.document_date,
      totalValue: inv.total_value,
      totalWeight: inv.total_weight,
      isAssigned: inv.is_assigned,
      isModified: inv.is_modified,
      lastModifiedAt: inv.last_modified_at,
      isCancelled: inv.is_cancelled,
      apiHash: inv.api_hash,
      items: (inv.invoice_items || []).map((item: any) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        weightKg: item.weight_kg,
        quantityPicked: item.quantity_picked || 0
      }))
    }));
  } catch (error) {
    console.error('❌ Erro ao carregar notas do banco:', error?.message || String(error));
    throw error;
  }
}

export async function updateInvoiceAssignedStatus(invoiceIds: string | string[], isAssigned: boolean): Promise<void> {
  try {
    const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];

    if (ids.length === 0) return;

    const { error } = await supabase
      .from('invoices')
      .update({ is_assigned: isAssigned })
      .in('id', ids);

    if (error) throw error;
  } catch (error) {
    console.error('❌ Erro ao atualizar status da nota:', error?.message || String(error));
    throw error;
  }
}