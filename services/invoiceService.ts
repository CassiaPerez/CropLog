import { supabase } from './supabase';
import { Invoice, Product } from '../types';

export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<void> {
  try {
    console.log(`💾 Salvando ${invoices.length} notas no banco de dados...`);
    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const invoice of invoices) {
      try {
        const { data: existingInvoice, error: checkError } = await supabase
          .from('invoices')
          .select('id, is_assigned')
          .eq('number', invoice.number)
          .maybeSingle();

        if (checkError) {
          console.error(`❌ Erro ao verificar nota ${invoice.number}:`, checkError);
          errorCount++;
          continue;
        }

      if (existingInvoice) {
        console.log(`🔄 Atualizando nota existente: ${invoice.number}`);
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            customer_name: invoice.customerName,
            customer_city: invoice.customerCity,
            issue_date: invoice.issueDate,
            document_date: invoice.documentDate,
            total_value: invoice.totalValue,
            total_weight: invoice.totalWeight,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInvoice.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar nota ${invoice.number}:`, updateError);
          errorCount++;
          continue;
        }
        updatedCount++;

        const { error: deleteItemsError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', existingInvoice.id);

        if (deleteItemsError) {
          console.error(`Erro ao deletar itens da nota ${invoice.number}:`, deleteItemsError);
        }

        const items = invoice.items.map(item => ({
          invoice_id: existingInvoice.id,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          weight_kg: item.weightKg,
          quantity_picked: item.quantityPicked || null
        }));

        if (items.length > 0) {
          const { error: insertItemsError } = await supabase
            .from('invoice_items')
            .insert(items);

          if (insertItemsError) {
            console.error(`Erro ao inserir itens da nota ${invoice.number}:`, insertItemsError);
          }
        }
      } else {
        console.log(`➕ Inserindo nova nota: ${invoice.number}`);
        const { data: newInvoice, error: insertError } = await supabase
          .from('invoices')
          .insert({
            number: invoice.number,
            customer_name: invoice.customerName,
            customer_city: invoice.customerCity,
            issue_date: invoice.issueDate,
            document_date: invoice.documentDate,
            total_value: invoice.totalValue,
            total_weight: invoice.totalWeight,
            is_assigned: invoice.isAssigned || false
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Erro ao inserir nota ${invoice.number}:`, insertError);
          errorCount++;
          continue;
        }
        newCount++;

        if (newInvoice) {
          const items = invoice.items.map(item => ({
            invoice_id: newInvoice.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            weight_kg: item.weightKg,
            quantity_picked: item.quantityPicked || null
          }));

          if (items.length > 0) {
            const { error: insertItemsError } = await supabase
              .from('invoice_items')
              .insert(items);

            if (insertItemsError) {
              console.error(`Erro ao inserir itens da nota ${invoice.number}:`, insertItemsError);
            }
          }
        }
      }
      } catch (invoiceError) {
        console.error(`❌ Erro ao processar nota ${invoice.number}:`, invoiceError);
        errorCount++;
      }
    }

    console.log('📊 Resumo da sincronização:');
    console.log(`  ✅ Novas: ${newCount}`);
    console.log(`  🔄 Atualizadas: ${updatedCount}`);
    console.log(`  ❌ Erros: ${errorCount}`);
    console.log('✨ Sincronização concluída!');

    if (errorCount > 0 && (newCount + updatedCount) === 0) {
      throw new Error(`Falha ao salvar notas: ${errorCount} erros encontrados`);
    }
  } catch (error) {
    console.error('❌ Erro crítico ao salvar notas no banco:', error);
    throw error;
  }
}

export async function loadInvoicesFromDatabase(): Promise<Invoice[]> {
  try {
    console.log('Buscando notas no Supabase...');
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('Erro ao carregar notas:', invoicesError);
      return [];
    }

    console.log(`Encontradas ${invoicesData?.length || 0} notas no banco`);

    if (!invoicesData || invoicesData.length === 0) {
      console.log('Nenhuma nota encontrada no banco');
      return [];
    }

    const invoicesWithItems: Invoice[] = [];

    for (const invoiceData of invoicesData) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceData.id);

      if (itemsError) {
        console.error(`Erro ao carregar itens da nota ${invoiceData.number}:`, itemsError);
        continue;
      }

      const items: Product[] = (itemsData || []).map(item => ({
        sku: item.sku,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        weightKg: Number(item.weight_kg),
        quantityPicked: item.quantity_picked ? Number(item.quantity_picked) : undefined
      }));

      invoicesWithItems.push({
        id: invoiceData.id,
        number: invoiceData.number,
        customerName: invoiceData.customer_name,
        customerCity: invoiceData.customer_city,
        issueDate: invoiceData.issue_date,
        documentDate: invoiceData.document_date || invoiceData.issue_date,
        totalValue: Number(invoiceData.total_value),
        totalWeight: Number(invoiceData.total_weight),
        items: items,
        isAssigned: invoiceData.is_assigned
      });
    }

    console.log(`Retornando ${invoicesWithItems.length} notas com itens`);
    return invoicesWithItems;
  } catch (error) {
    console.error('Erro ao carregar notas do banco:', error);
    return [];
  }
}

export async function updateInvoiceAssignedStatus(invoiceIds: string[], isAssigned: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ is_assigned: isAssigned, updated_at: new Date().toISOString() })
      .in('id', invoiceIds);

    if (error) {
      console.error('Erro ao atualizar status de atribuição:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao atualizar notas:', error);
    throw error;
  }
}
