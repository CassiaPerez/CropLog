import { Invoice, Product } from '../types';

interface ErpItem {
  sku: string;
  name: string;
  qty: number;
  unit_measure: string;
  weight_kg: number;
}

interface ErpInvoiceResponse {
  invoice_number: string;
  customer: {
    name: string;
    city: string;
  };
  issued_at: string;
  total_amount: number;
  total_gross_weight: number;
  items: ErpItem[];
}

/**
 * Service to fetch invoices from an external ERP API.
 * Expected Endpoint: GET /invoices?status=ready_for_shipping
 */
export const fetchErpInvoices = async (baseUrl: string, token: string): Promise<Invoice[]> => {
  if (!baseUrl) throw new Error("URL da API não configurada.");

  // Remove trailing slash if present to avoid double slashes
  const cleanUrl = baseUrl.replace(/\/$/, '');
  
  try {
    const response = await fetch(`${cleanUrl}/invoices?status=ready_for_shipping`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        if (response.status === 401) throw new Error("Não autorizado (401). Verifique o Token.");
        if (response.status === 404) throw new Error("Endpoint não encontrado (404).");
        throw new Error(`Erro na API: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map External ERP structure to Internal App Structure
    // Assuming the API returns { data: [...] } or just [...]
    const payload = Array.isArray(data) ? data : (data.data || []);

    return payload.map((inv: ErpInvoiceResponse, index: number) => ({
      id: `ext-${inv.invoice_number}`,
      number: inv.invoice_number,
      customerName: inv.customer.name,
      customerCity: inv.customer.city,
      issueDate: inv.issued_at,
      totalValue: inv.total_amount,
      totalWeight: inv.total_gross_weight,
      isAssigned: false, // New invoices from ERP are usually unassigned
      items: inv.items.map((item: ErpItem) => ({
        sku: item.sku,
        description: item.name,
        quantity: item.qty,
        unit: item.unit_measure,
        weightKg: item.weight_kg,
        quantityPicked: 0
      }))
    }));

  } catch (error) {
    console.error("ERP Sync Failed:", error);
    throw error;
  }
};