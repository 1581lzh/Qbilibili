export function toHttps(url: string): string {
  if (!url) return url;
  return url.replace(/^http:\/\//, "https://");
}

export function optimizedCover(url: string | null | undefined, width = 640): string {
  if (!url) return "";
  const httpsUrl = toHttps(url);
  if (httpsUrl.includes("picsum.photos")) {
    const height = Math.round(width * 9 / 16);
    const replaced = httpsUrl.replace(/\/\d+\/\d+$/, `/${width}/${height}`);
    if (replaced !== httpsUrl) return replaced;
    const sep = httpsUrl.includes("?") ? "&" : "?";
    return `${httpsUrl}${sep}w=${width}&h=${height}&fit=crop`;
  }
  const sep = httpsUrl.includes("?") ? "&" : "?";
  return `${httpsUrl}${sep}x-oss-process=image/resize,w_${width}/format,webp/quality,q_80`;
}
