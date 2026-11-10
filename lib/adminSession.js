import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "cut-cuddle-admin";
export const SESSION_SECONDS = 60 * 60 * 12;

const digest = (value) => createHash("sha256").update(value).digest();

export const passwordMatches = (candidate, password = process.env.ADMIN_PASSWORD) =>
  Boolean(password && typeof candidate === "string" &&
    timingSafeEqual(digest(candidate), digest(password)));

const sign = (payload, password) =>
  createHmac("sha256", digest(`cut-cuddle-session:${password}`))
    .update(payload).digest("base64url");

export const createSession = (password = process.env.ADMIN_PASSWORD, now = Date.now()) => {
  if (!password) throw new Error("ADMIN_PASSWORD is not configured.");
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${sign(payload, password)}`;
};

export const verifySession = (token, password = process.env.ADMIN_PASSWORD, now = Date.now()) => {
  if (!password || typeof token !== "string" || token.length > 256) return false;
  const [expiry, nonce, signature, extra] = token.split(".");
  if (extra || !/^\d+$/.test(expiry) || !/^[a-f0-9]{48}$/.test(nonce || "")) return false;
  const seconds = Math.floor(now / 1000);
  if (Number(expiry) <= seconds || Number(expiry) > seconds + SESSION_SECONDS) return false;
  const expected = sign(`${expiry}.${nonce}`, password);
  return Boolean(/^[A-Za-z0-9_-]{43}$/.test(signature || "") &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
};
