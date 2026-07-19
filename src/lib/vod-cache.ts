interface CacheEntry {
  auth: string;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export async function getVodPlayAuth(vodVideoId: string): Promise<string | null> {
  const cached = cache.get(vodVideoId);
  if (cached && cached.expires > Date.now()) {
    return cached.auth;
  }

  try {
    const res = await fetch("/api/vod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "playAuth", videoId: vodVideoId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(vodVideoId, { auth: data.playAuth, expires: Date.now() + TTL_MS });
    return data.playAuth;
  } catch {
    return null;
  }
}
