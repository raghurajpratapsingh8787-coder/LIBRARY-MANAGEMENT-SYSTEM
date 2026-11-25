let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!res.ok) {
        inMemoryAccessToken = null;
        return null;
      }
      const data = await res.json();
      inMemoryAccessToken = data.accessToken || null;
      return inMemoryAccessToken;
    } catch {
      inMemoryAccessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retryOn401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh')) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch<T>(url, options, false);
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!res.ok) throw new Error('Failed to export CSV.');
    return (await res.text()) as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }

  return data as T;
}

export async function fetchAuthorizedImageBlobUrl(url: string): Promise<string> {
  const headers = new Headers();
  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load cover image.');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
