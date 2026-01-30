import { Invoice, LoadMap, LoadStatus, User } from './types';

export const CARRIER_LIST = [
  "AJL LOGISTICA E TRANSPORTES LTDA",
  "ALFA TRANSPORTES LTDA",
  "ANDERLE-TRANSPORTES LTDA",
  "ANTONIO JOAO SOARES NETO TRANSPORTES LTDA",
  "ARENA TRANSPORTES EIRELI ME",
  "ASTUTI TRANSPORTE E LOGISTICA LTDA",
  "BAGGIO & BAGGIO LTDA",
  "BIOCROP MS COMERCIO DE INSUMOS AGRICOLAS LTDA",
  "BRAVO SERVICOS LOGISTICOS LTDA",
  "CARGOMODAL TRANSPORTES",
  "CARGOMODAL TRANSPORTES SERVICOS E LOCACAO LTDA",
  "CR7 LOG TRANSPORTES E LOGISTICA LTDA",
  "E ZANATTA & CIA LTDA - ME",
  "E.R.S TRANSPORTES LTDA",
  "ENVIA RAPIDO LOGISTICA EXPRESS LTDA",
  "EVOLUCAO AGRICOLA LTDA",
  "EXPRESSO SAO MIGUEL S/A",
  "FARMLOG CORRETORA DE SEGUROS, ADMINISTRAÇÃO E LOGISTICA DE AGRONEGOCIOS LTDA",
  "GPM TRANSPORTES LTDA",
  "LUFT LOGISTICS LTDA",
  "PAULISTANO TRANSPORTES E LOGISTICA LTDA",
  "PFS TRANSPORTES LTDA",
  "RODOAGRO TRANSPORTES LTDA",
  "TRANSBEN TRANSPORTES LTDA",
  "TRANSCROP TRANSPORTES RODOVIARIOS DE CARGAS LTDA",
  "TRANSETE TRANSPORTE SEGURO LTDA",
  "TRANSPORTES WALDEMAR LTDA",
  "UNIDADE MT TRANSPORTE E LOGISTICA LTDA ME"
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Carlos Admin', role: 'ADMIN' },
  { id: 'u2', name: 'Ana Planejamento', role: 'LOGISTICA_PLANEJAMENTO' },
  { id: 'u3', name: 'João Separação', role: 'SEPARACAO' },
  { id: 'u4', name: 'Marcos Operação', role: 'STATUS_OPERACAO' },
];

// Simulate a database of products
const MOCK_PRODUCTS = [
  { sku: 'IND-001', description: 'Válvula Industrial Tipo A', unit: 'UN', weightKg: 2.5 },
  { sku: 'IND-002', description: 'Bomba Hidráulica Pro', unit: 'UN', weightKg: 15.0 },
  { sku: 'ELEC-055', description: 'Painel de Controle V2', unit: 'CX', weightKg: 8.0 },
  { sku: 'SAFE-99', description: 'Capacete de Segurança - Amarelo', unit: 'UN', weightKg: 0.4 },
  { sku: 'PIPE-PVC', description: 'Tubo PVC 4m', unit: 'PC', weightKg: 1.2 },
];

// Helper to generate random invoices
const generateInvoices = (count: number): Invoice[] => {
  const invoices: Invoice[] = [];
  for (let i = 0; i < count; i++) {
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = [];
    let totalWeight = 0;
    let totalValue = 0;

    for (let j = 0; j < itemCount; j++) {
      const prod = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
      const qty = Math.floor(Math.random() * 10) + 1;
      items.push({ ...prod, quantity: qty, quantityPicked: 0 });
      totalWeight += prod.weightKg * qty;
      totalValue += (Math.random() * 500) * qty;
    }

    invoices.push({
      id: `inv-${i}`,
      number: `NF-${10200 + i}`,
      customerName: `Indústria Parceira ${String.fromCharCode(65 + i)}`,
      customerCity: ['São Paulo', 'Campinas', 'Jundiaí', 'Sorocaba'][Math.floor(Math.random() * 4)],
      issueDate: new Date().toISOString().split('T')[0],
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalWeight: parseFloat(totalWeight.toFixed(2)),
      items,
      isAssigned: Math.random() > 0.7, // Some are already assigned
    });
  }
  return invoices;
};

export const MOCK_INVOICES: Invoice[] = generateInvoices(20);

export const MOCK_LOAD_MAPS: LoadMap[] = [
  {
    id: 'lm-001',
    code: 'MAP-2024-001',
    carrierName: 'AJL LOGISTICA E TRANSPORTES LTDA',
    vehiclePlate: 'ABC-1234',
    sourceCity: 'São Paulo - SP',
    route: 'SP - Interior Sul',
    status: LoadStatus.IN_TRANSIT,
    currentCity: 'Jundiaí - SP',
    logisticsNotes: 'Motorista relatou tráfego intenso na rodovia 050. ETA atrasado em 1 hora.',
    createdAt: '2023-10-25',
    invoices: MOCK_INVOICES.slice(0, 2),
    timeline: [
        {
            id: 'evt-1',
            timestamp: '2023-10-25T10:00:00Z',
            status: LoadStatus.PLANNING,
            description: 'Mapa criado',
            userId: 'u2',
            userName: 'Ana Planejamento'
        },
        {
            id: 'evt-2',
            timestamp: '2023-10-25T14:30:00Z',
            status: LoadStatus.IN_TRANSIT,
            description: 'Saiu para entrega',
            userId: 'u4',
            userName: 'Marcos Operação'
        }
    ]
  },
  {
    id: 'lm-002',
    code: 'MAP-2024-002',
    carrierName: 'EXPRESSO SAO MIGUEL S/A',
    vehiclePlate: 'XYZ-9876',
    sourceCity: 'Guarulhos - SP',
    route: 'SP - Capital',
    status: LoadStatus.SEPARATION,
    currentCity: 'São Paulo - SP',
    logisticsNotes: 'Entrega prioritária solicitada pelo cliente Indústria Parceira C.',
    createdAt: '2023-10-26',
    invoices: MOCK_INVOICES.slice(2, 4),
    timeline: [
         {
            id: 'evt-3',
            timestamp: '2023-10-26T08:00:00Z',
            status: LoadStatus.PLANNING,
            description: 'Mapa criado',
            userId: 'u2',
            userName: 'Ana Planejamento'
        }
    ]
  },
];