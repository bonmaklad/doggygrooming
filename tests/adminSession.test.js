import test from "node:test";
import assert from "node:assert/strict";
import { createSession, passwordMatches, SESSION_SECONDS, verifySession } from "../lib/adminSession.js";
import { isSameOrigin } from "../lib/adminOrigin.js";

test("origin checks use the browser's host when Next normalises the internal URL", () => {
  const request = { url: "http://localhost:3000/api/admin/session", headers: new Headers({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }) };
  assert.equal(isSameOrigin(request, ""), true);
  request.headers.set("origin", "https://attacker.example");
  assert.equal(isSameOrigin(request, ""), false);
  request.headers.delete("origin");
  assert.equal(isSameOrigin(request, ""), false);
});

test("a configured public origin is authoritative behind a proxy", () => {
  const request = { url: "http://internal:3000/api/admin/session", headers: new Headers({ host: "internal:3000", origin: "https://cut-cuddle.example" }) };
  assert.equal(isSameOrigin(request, "https://cut-cuddle.example"), true);
  assert.equal(isSameOrigin(request, "https://different.example"), false);
});

test("password is required and compared safely", () => {
  assert.equal(passwordMatches("secret", "secret"), true);
  assert.equal(passwordMatches("wrong", "secret"), false);
  assert.equal(passwordMatches(undefined, "secret"), false);
  assert.equal(passwordMatches("", ""), false);
});

test("sessions expire, reject tampering and rotate with the password", () => {
  const now = Date.UTC(2026, 10, 10);
  const token = createSession("private password", now);
  assert.equal(verifySession(token, "private password", now), true);
  assert.equal(verifySession(token, "private password", now + SESSION_SECONDS * 1000), false);
  assert.equal(verifySession(token, "changed password", now), false);
  assert.equal(verifySession(`${token}x`, "private password", now), false);
  assert.equal(verifySession(token, "", now), false);
  assert.notEqual(createSession("private password", now), token);
});

test("malformed and unicode signatures fail closed without throwing", () => {
  const now = Date.now();
  const token = createSession("password", now);
  const payload = token.split(".").slice(0, 2).join(".");
  for (const bad of [null, "", "abc", `${payload}.${"é".repeat(43)}`, `${payload}.`, `${token}.extra`, "x".repeat(1000)]) {
    assert.equal(verifySession(bad, "password", now), false);
  }
});
