/**
 * Safely serializes an error to a string, avoiding circular reference issues
 */
export function serializeError(error: unknown): string {
  if (!error) {
    return 'Erro desconhecido';
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    try {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }

      const errorString = String(error);
      if (errorString && errorString !== '[object Object]') {
        return errorString;
      }

      return 'Erro ao processar resposta';
    } catch {
      return 'Erro ao processar resposta';
    }
  }

  try {
    return String(error);
  } catch {
    return 'Erro desconhecido';
  }
}

/**
 * Safely logs an error to console
 */
export function logError(context: string, error: unknown): void {
  console.error(`❌ ${context}:`, serializeError(error));
}
