import { supabase } from './supabase';
import { Invoice, SyncSummary, EMPTY_SYNC_SUMMARY } from '../types';
import { serializeError, logError } from '../utils/errorUtils';
import { generateSHA256Hash } from '../utils/hashUtils';

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

async function hasInvoiceChanged(newInv: Invoice, oldInv: any, newHash: string): Promise<boolean> {
  if (!oldInv) return true;

  if (oldInv.source_hash) {
    return newHash !== oldInv.source_hash;
  }

  if (oldInv.erp_data_hash) {
    return newHash !== oldInv.erp_data_hash;
  }

  const isValueDiff = Math.abs(newInv.totalValue - oldInv.total_value) > 0.01;
  const isWeightDiff = Math.abs(newInv.totalWeight - oldInv.total_weight) > 0.001;
  const isDateDiff = newInv.issueDate !== oldInv.issue_date;
  const isCustomerDiff = newInv.customerName !== oldInv.customer_name;

  return isValueDiff || isWeightDiff || isDateDiff || isCustomerDiff;
}

export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<SyncSummary> {
  const summary: SyncSummary = {
    ...EMPTY_SYNC_SUMMARY,
    lastSyncAt: new Date().toISOString()
  };

  if (invoices.length === 0) {
    console.log('⚠️ Nenhuma nota fiscal para processar');
    return summary;
  }

  console.log(`🚀 Iniciando sincronização inteligente de ${invoices.length} notas...`);
  const startTime = performance.now();

  const apiInvoiceNumbers = invoices.map(inv => inv.number);
  const batchSize = 1000;
  let allExistingInvoices: any[] = [];

  for (let i = 0; i < apiInvoiceNumbers.length; i += batchSize) {
    const batch = apiInvoiceNumbers.slice(i, i + batchSize);
    const { data } = await supabase
      .from('invoices')
      .select('id, number, total_value, total_weight, issue_date, customer_name, erp_data_hash, is_cancelled')
      .in('number', batch);

    if (data) {
      allExistingInvoices.push(...data);
    }
  }

  const existingMap = new Map();
  allExistingInvoices.forEach(inv => existingMap.set(inv.number, inv));

  const { data: unassignedInvoices } = await supabase
    .from('invoices')
    .select('id, number')
    .eq('is_assigned', false)
    .eq('is_cancelled', false);

  const toCancel = (unassignedInvoices || []).filter(
    inv => !apiInvoiceNumbers.includes(inv.number)
  );

  if (toCancel.length > 0) {
    console.log(`🚫 Marcando ${toCancel.length} notas como canceladas...`);
    const idsToCancel = toCancel.map(inv => inv.id);
    const cancelBatchSize = 50;

    for (let i = 0; i < idsToCancel.length; i += cancelBatchSize) {
      const batch = idsToCancel.slice(i, i + cancelBatchSize);
      const { error: cancelError } = await supabase
        .from('invoices')
        .update({
          is_cancelled: true,
          cancelled_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString()
        })
        .in('id', batch);

      if (cancelError) {
        console.error('❌ Erro ao marcar notas como canceladas:', cancelError.message);
        logError('Erro ao cancelar lote', cancelError);
        summary.errorsCount += batch.length;
      } else {
        summary.cancelledCount += batch.length;
        console.log(`✅ Lote ${i / cancelBatchSize + 1}: ${batch.length} notas canceladas`);
      }
    }

    if (summary.cancelledCount > 0) {
      console.log(`✅ Total: ${summary.cancelledCount} notas marcadas como canceladas`);
    }
  }

  const invoicesToSave: { invoice: Invoice; hash: string; isNew: boolean }[] = [];

  for (const invoice of invoices) {
    const hash = await createInvoiceHash(invoice);
    const oldInvoice = existingMap.get(invoice.number);
    const changed = await hasInvoiceChanged(invoice, oldInvoice, hash);

    if (!oldInvoice) {
      invoicesToSave.push({ invoice, hash, isNew: true });
    } else if (changed) {
      invoicesToSave.push({ invoice, hash, isNew: false });
    } else {
      summary.unchangedCount++;
    }
  }

  console.log(`💾 Processando: ${invoicesToSave.length} notas alteradas/novas (de ${invoices.length} totais).`);
  console.log(`⏭️ Sem mudanças: ${summary.unchangedCount}`);

  if (invoicesToSave.length === 0) {
    console.log('✅ Nenhuma alteração necessária.');
    return summary;
  }

  const BATCH_SIZE = 10;

  for (let i = 0; i < invoicesToSave.length; i += BATCH_SIZE) {
    const chunk = invoicesToSave.slice(i, i + BATCH_SIZE);

    await Promise.all(chunk.map(async ({ invoice, hash, isNew }) => {
      try {
        const oldInvoice = existingMap.get(invoice.number);
        const wasReactivated = oldInvoice?.is_cancelled;
        const invoiceId = oldInvoice?.id || crypto.randomUUID();
        const now = new Date().toISOString();

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
            source_hash: hash,
            source_updated_at: now,
            is_modified: !isNew,
            is_cancelled: false,
            cancelled_at: null,
            last_modified_at: (!isNew || wasReactivated) ? now : undefined,
            last_synced_at: now,
            updated_at: now
          }, { onConflict: 'number' });

        if (upsertError) throw upsertError;

        await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

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

        if (isNew) {
          summary.insertedCount++;
        } else {
          summary.updatedCount++;
        }
      } catch (err) {
        console.error(`❌ Falha na nota ${invoice.number}:`, err?.message || String(err));
        summary.errorsCount++;
      }
    }));

    console.log(`⏳ Processado lote ${i + chunk.length}/${invoicesToSave.length}`);
  }

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n✨ Sincronização finalizada em ${duration}s`);
  console.log(`📊 Resumo:`);
  console.log(`  🆕 Novas: ${summary.insertedCount}`);
  console.log(`  🔄 Atualizadas: ${summary.updatedCount}`);
  console.log(`  ⏭️ Sem mudanças: ${summary.unchangedCount}`);
  console.log(`  🚫 Canceladas: ${summary.cancelledCount}`);
  console.log(`  ❌ Erros: ${summary.errorsCount}`);
  console.log(`  📦 Total processado: ${invoices.length} notas\n`);

  if (summary.errorsCount > 0) {
    console.warn(`⚠️ Sincronização concluída com ${summary.errorsCount} erro(s)`);
  }

  return summary;
}

export async function loadInvoicesFromDatabase(includeCancelled: boolean = false): Promise<Invoice[]> {
  try {
    let query = supabase
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
      `);

    if (!includeCancelled) {
      query = query.eq('is_cancelled', false);
    }

    const { data: invoices, error } = await query.order('document_date', { ascending: false });

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
    logError('Erro ao carregar notas do banco', error);
    throw new Error(serializeError(error));
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
    logError('Erro ao atualizar status da nota', error);
    throw new Error(serializeError(error));
  }
}

export async function deleteAllInvoices(): Promise<{ deletedCount: number }> {
  try {
    console.log('🗑️ Iniciando limpeza de todas as notas fiscais...');

    const { data: invoicesData, error: countError } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' });

    if (countError) throw countError;

    const totalCount = invoicesData?.length || 0;

    if (totalCount === 0) {
      console.log('✅ Nenhuma nota fiscal encontrada para deletar.');
      return { deletedCount: 0 };
    }

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .delete()
      .neq('invoice_id', '00000000-0000-0000-0000-000000000000');

    if (itemsError) {
      console.error('❌ Erro ao deletar itens:', itemsError);
      throw itemsError;
    }

    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (invoicesError) {
      console.error('❌ Erro ao deletar notas fiscais:', invoicesError);
      throw invoicesError;
    }

    console.log(`✅ ${totalCount} notas fiscais deletadas com sucesso!`);
    return { deletedCount: totalCount };
  } catch (error) {
    logError('Erro ao deletar todas as notas fiscais', error);
    throw new Error(serializeError(error));
  }
}

export async function deleteAllData(): Promise<{
  invoices: number;
  loadMaps: number;
  users: number;
  syncHistory: number;
}> {
  try {
    console.log('🗑️ Iniciando limpeza COMPLETA do banco de dados...');

    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' });

    const { data: loadMapsData } = await supabase
      .from('load_maps')
      .select('id', { count: 'exact' });

    const { data: usersData } = await supabase
      .from('app_users')
      .select('id', { count: 'exact' });

    const { data: syncHistoryData } = await supabase
      .from('sync_history')
      .select('id', { count: 'exact' });

    const counts = {
      invoices: invoicesData?.length || 0,
      loadMaps: loadMapsData?.length || 0,
      users: usersData?.length || 0,
      syncHistory: syncHistoryData?.length || 0
    };

    console.log('📊 Registros a deletar:', counts);

    await supabase.from('load_map_timeline').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Timeline de mapas deletada');

    await supabase.from('load_map_invoices').delete().neq('load_map_id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Relação mapa-notas deletada');

    await supabase.from('load_maps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Mapas de carga deletados');

    await supabase.from('invoice_items').delete().neq('invoice_id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Itens de notas deletados');

    await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Notas fiscais deletadas');

    await supabase.from('sync_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Histórico de sincronização deletado');

    await supabase.from('app_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Usuários deletados');

    console.log('✨ Limpeza completa do banco de dados finalizada!');
    return counts;
  } catch (error) {
    logError('Erro ao deletar todos os dados', error);
    throw new Error(serializeError(error));
  }
}