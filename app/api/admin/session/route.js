import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { adminJson, isSameOrigin } from "../../../../lib/adminAuth";
import { ADMIN_COOKIE, SESSION_SECONDS, createSession, passwordMatches } from "../../../../lib/adminSession";

export const dynamic = "force-dynamic";
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request) {
  if (!isSameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  if (!process.env.ADMIN_PASSWORD) return adminJson({ error: "Set ADMIN_PASSWORD in the server .env file first." }, 503);
  // Bounded, per-process throttling. Also set an edge rate limit for multi-instance hosting.
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = createHash("sha256").update(request.headers.get("x-forwarded-for") || "local").digest("hex");
  const entry = attempts.get(key) || { count: 0, until: now + WINDOW_MS };
  if (entry.count >= 8 || attempts.size >= 10000) {
    const response = adminJson({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
    response.headers.set("Retry-After", "900");
    return response;
  }
  let payload;
  try { payload = await request.json(); } catch { return adminJson({ error: "Invalid request." }, 400); }
  if (!passwordMatches(payload?.password)) {
    attempts.set(key, { ...entry, count: entry.count + 1 });
    return adminJson({ error: "That password isn't correct." }, 401);
  }
  attempts.delete(key);
  (await cookies()).set(ADMIN_COOKIE, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return adminJson({ ok: true });
}

export async function DELETE(request) {
  if (!isSameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return adminJson({ ok: true });
}
