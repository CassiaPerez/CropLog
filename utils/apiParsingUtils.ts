function parseNumeric(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export function getApiItems(payload: any): any[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.data && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.items && Array.isArray(payload.items)) {
    return payload.items;
  }

  if (payload.results && Array.isArray(payload.results)) {
    return payload.results;
  }

  if (payload.records && Array.isArray(payload.records)) {
    return payload.records;
  }

  return [];
}

export function getApiTotal(payload: any): number {
  if (!payload) return 0;

  const candidates = [
    payload.total,
    payload.totalCount,
    payload.count,
    payload.totalRecords,
    payload.qtd_total,
    payload.quantidade_total,
    payload.total_registros,
    payload.totalItems,
  ];

  for (const val of candidates) {
    const n = parseNumeric(val);
    if (n !== null && n > 0) return n;
  }

  const items = getApiItems(payload);
  return items.length;
}

export function getApiLimit(payload: any, defaultLimit: number = 100): number {
  if (!payload) return defaultLimit;

  const candidates = [
    payload.limit,
    payload.pageSize,
    payload.perPage,
    payload.per_page,
    payload.page_size,
  ];

  for (const val of candidates) {
    const n = parseNumeric(val);
    if (n !== null && n > 0) return n;
  }

  return defaultLimit;
}

export function getApiTotalExplicit(payload: any): number | null {
  if (!payload) return null;

  const candidates = [
    payload.total,
    payload.totalCount,
    payload.count,
    payload.totalRecords,
    payload.qtd_total,
    payload.quantidade_total,
    payload.total_registros,
    payload.totalItems,
  ];

  for (const val of candidates) {
    const n = parseNumeric(val);
    if (n !== null && n > 0) return n;
  }

  return null;
}

export function getApiPage(payload: any, defaultPage: number = 1): number {
  if (!payload) return defaultPage;

  const candidates = [
    payload.page,
    payload.currentPage,
    payload.pageNumber,
    payload.current_page,
  ];

  for (const val of candidates) {
    const n = parseNumeric(val);
    if (n !== null) return n;
  }

  return defaultPage;
}
