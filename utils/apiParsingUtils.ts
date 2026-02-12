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

  if (typeof payload.total === 'number') {
    return payload.total;
  }

  if (typeof payload.totalCount === 'number') {
    return payload.totalCount;
  }

  if (typeof payload.count === 'number') {
    return payload.count;
  }

  if (typeof payload.totalRecords === 'number') {
    return payload.totalRecords;
  }

  const items = getApiItems(payload);
  return items.length;
}

export function getApiLimit(payload: any, defaultLimit: number = 100): number {
  if (!payload) return defaultLimit;

  if (typeof payload.limit === 'number') {
    return payload.limit;
  }

  if (typeof payload.pageSize === 'number') {
    return payload.pageSize;
  }

  if (typeof payload.perPage === 'number') {
    return payload.perPage;
  }

  return defaultLimit;
}

export function getApiPage(payload: any, defaultPage: number = 1): number {
  if (!payload) return defaultPage;

  if (typeof payload.page === 'number') {
    return payload.page;
  }

  if (typeof payload.currentPage === 'number') {
    return payload.currentPage;
  }

  if (typeof payload.pageNumber === 'number') {
    return payload.pageNumber;
  }

  return defaultPage;
}
