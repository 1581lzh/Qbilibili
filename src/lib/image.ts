export function toHttps(url: string): string {
  if (!url) return url;
  return url.replace(/^http:\/\//, "https://");
}

export function optimizedCover(url: string | null | undefined, width = 640): string {
  if (!url) return "";
  const httpsUrl = toHttps(url);
  const sep = httpsUrl.includes("?") ? "&" : "?";
  return `${httpsUrl}${sep}x-oss-process=image/resize,w_${width}/format,webp`;
}
