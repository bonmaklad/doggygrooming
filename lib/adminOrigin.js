const normalizeOrigin = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const isSameOrigin = (request, configuredOrigin = process.env.APP_ORIGIN) => {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) return false;
  if (configuredOrigin?.trim()) return origin === normalizeOrigin(configuredOrigin);

  const url = new URL(request.url);
  // Cloudflare/the TLS proxy supplies the browser's protocol. Next's internal
  // URL can still be HTTP even though the browser requested this site over HTTPS.
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol === null ? url.protocol.slice(0, -1) : forwardedProtocol.trim().toLowerCase();
  if (!["http", "https"].includes(protocol)) return false;

  // Keep Host authoritative; do not accept an arbitrary X-Forwarded-Host.
  // A proxy that rewrites Host must use the explicit APP_ORIGIN setting.
  const host = request.headers.get("host") || url.host;
  return origin === normalizeOrigin(`${protocol}://${host}`);
};
