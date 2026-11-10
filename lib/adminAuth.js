import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySession } from "./adminSession";
import { isSameOrigin } from "./adminOrigin";

export { isSameOrigin };

export const isAdmin = async () => verifySession((await cookies()).get(ADMIN_COOKIE)?.value);

export const adminJson = (data, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});

export const guardAdmin = async (request, write = false) => {
  if (!await isAdmin()) return adminJson({ error: "Please sign in again." }, 401);
  if (write && !isSameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  return null;
};
