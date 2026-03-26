import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithRetry } from './api.js';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ price: 100 }), { status: 200 }),
    );

    const result = await fetchWithRetry('https://example.com/api');
    expect(result).toEqual({ price: 100 });
  });

  it('returns null after exhausting retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const result = await fetchWithRetry('https://example.com/api', {
      retries: 2,
      baseDelayMs: 10,
    });
    expect(result).toBeNull();
  });

  it('retries on non-200 status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const result = await fetchWithRetry('https://example.com/api', {
      retries: 3,
      baseDelayMs: 10,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
