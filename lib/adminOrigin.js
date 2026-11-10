export const isSameOrigin = (request, configuredOrigin = process.env.APP_ORIGIN) => {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (configuredOrigin) return origin === configuredOrigin;
  const url = new URL(request.url);
  // Next can normalise request.url to localhost even when the browser uses
  // 127.0.0.1. The incoming Host is the actual origin the browser addressed.
  const host = request.headers.get("host") || url.host;
  return origin === `${url.protocol}//${host}`;
};
