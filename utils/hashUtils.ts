export async function generateSHA256Hash(data: any): Promise<string> {
  const sortedData = sortObjectKeys(data);
  const jsonString = JSON.stringify(sortedData);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sortedObj: any = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }

  return sortedObj;
}

export function generateSimpleHash(data: any): string {
  const sortedData = sortObjectKeys(data);
  return btoa(JSON.stringify(sortedData));
}
