interface FetchOptions {
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchWithRetry<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const { retries = 3, baseDelayMs = 1500 } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) {
        console.error(
          `fetchWithRetry failed after ${retries} attempts for ${url}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

export async function rateLimitedSleep(ms: number = 1500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
