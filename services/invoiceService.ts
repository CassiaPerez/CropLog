import { supabase } from './supabase';
import { Invoice } from '../types';

// Salva/atualiza notas no banco (não mexe no id uuid do banco)
export async function saveInvoicesToDatabase(invoices: Invoice[]): Promise<void> {
  try {
    console.log(`Salvando ${invoices.length} notas no banco de dados...`);

    for (const invoice of invoices) {
      // Procura por número (chave de negócio) para evitar duplicidade
      const { data: existingInvoice, error: checkError } = await supabase
        .from('invoices')
        .select('id, is_assigned')
        .eq('number', invoice.number)
        .maybeSingle();

      if (checkError) {
        console.error(`Erro ao verificar nota ${invoice.number}:`, checkError);
        continue;
      }

      if (existingInvoice) {
        // Atualiza (sem alterar o id uuid)
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            customer_name: invoice.customerName,
            customer_city: invoice.customerCity,
            issue_date: invoice.issueDate,
            document_date: invoice.documentDate,
            total_value: invoice.totalValue,
            total_weight: invoice.totalWeight,
            items: invoice.items,
            // Mantém o status atual se já existe
            is_assigned: existingInvoice.is_assigned ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInvoice.id);

        if (updateError) {
          console.error(`Erro ao atualizar nota ${invoice.number}:`, updateError);
        }
      } else {
        // Insere nova (deixa o banco gerar o id uuid)
        const { error: insertError } = await supabase.from('invoices').insert({
          number: invoice.number,
          customer_name: invoice.customerName,
          customer_city: invoice.customerCity,
          issue_date: invoice.issueDate,
          document_date: invoice.documentDate,
          total_value: invoice.totalValue,
          total_weight: invoice.totalWeight,
          items: invoice.items,
          is_assigned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error(`Erro ao inserir nota ${invoice.number}:`, insertError);
        }
      }
    }

    console.log('Notas salvas com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar notas:', error);
    throw error;
  }
}

export async function loadInvoicesFromDatabase(): Promise<Invoice[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('document_date', { ascending: false });

    if (error) {
      console.error('Erro ao carregar notas:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      number: row.number,
      customerName: row.customer_name,
      customerCity: row.customer_city,
      issueDate: row.issue_date,
      documentDate: row.document_date,
      totalValue: row.total_value,
      totalWeight: row.total_weight,
      items: row.items || [],
      isAssigned: row.is_assigned || false,
    }));
  } catch (error) {
    console.error('Erro ao carregar notas:', error);
    return [];
  }
}

/**
 * ✅ CORRIGIDO: aceita 1 id ou vários ids (array)
 * Usa `.in('id', ids)` (em vez de `.eq('id', "uuid1,uuid2")`)
 */
export async function updateInvoiceAssignedStatus(
  ids: string[] | string,
  isAssigned: boolean
): Promise<void> {
  try {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    // Se quiser segurança extra:
    // const onlyUuids = idList.filter(x => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x));
    // if (onlyUuids.length === 0) return;

    const { error } = await supabase
      .from('invoices')
      .update({
        is_assigned: isAssigned,
        updated_at: new Date().toISOString(),
      })
      .in('id', idList);

    if (error) {
      console.error('❌ Erro ao atualizar status da(s) nota(s):', error);
      throw error;
    }

    console.log(`✅ Status atualizado para ${isAssigned ? 'atribuída' : 'livre'} em ${idList.length} nota(s).`);
  } catch (error) {
    console.error('Erro ao atualizar status da nota:', error);
    throw error;
  }
}