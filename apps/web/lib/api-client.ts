export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  let payload: (Record<string, unknown> & { error?: unknown }) | null = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as Record<string, unknown> & { error?: unknown };
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : response.status >= 500
          ? `Server error (${response.status}). Please try again.`
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  if (payload === null || typeof payload !== 'object') {
    throw new ApiError('Server returned an invalid response', response.status);
  }
  return payload as T;
}
