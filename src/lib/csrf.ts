const ALLOWED_ORIGINS = [
  "http://localhost:3005",
  "http://127.0.0.1:3005",
];

function getAllowedOrigins(): string[] {
  const base = [...ALLOWED_ORIGINS];
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (nextauthUrl) {
    try {
      const url = new URL(nextauthUrl);
      base.push(`${url.protocol}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`);
    } catch {}
  }
  return [...new Set(base)];
}

export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return false;

  const source = origin || referer;
  try {
    const url = new URL(source!);
    const allowed = getAllowedOrigins();
    const isAllowed = allowed.some((allowedOrigin) => {
      const allowedUrl = new URL(allowedOrigin);
      return url.hostname === allowedUrl.hostname;
    });
    if (isAllowed) return true;

    const host = request.headers.get("host");
    if (host && url.hostname === host.split(":")[0]) return true;

    return false;
  } catch {
    return false;
  }
}

export function requireValidOrigin(request: Request): Response | null {
  if (!validateOrigin(request)) {
    return Response.json(
      { error: "请求来源无效" },
      { status: 403 }
    );
  }
  return null;
}
