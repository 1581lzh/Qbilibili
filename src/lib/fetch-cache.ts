const cache = new Map<string, { data: unknown; expires: number }>();

export async function cachedFetch(url: string, ttlMs: number = 60000): Promise<unknown> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expires > now) return hit.data;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, expires: now + ttlMs });
  return data;
}
