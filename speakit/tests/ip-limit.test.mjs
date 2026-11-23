import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const jiti = require("jiti")(__filename);

const {
  MAX_GUEST_ACCOUNTS_PER_IP_24H,
  extractClientIpFromHeaders,
  hashIpAddress,
} = jiti(resolve(__dirname, "../lib/neon-auth.ts"));

test("MAX_GUEST_ACCOUNTS_PER_IP_24H is a positive integer limit", () => {
  assert.equal(MAX_GUEST_ACCOUNTS_PER_IP_24H, 3);
});

test("extractClientIpFromHeaders parses x-forwarded-for list, x-real-ip, and missing headers", () => {
  const forwardedHeaders = new Headers({
    "x-forwarded-for": " 203.0.113.10 , 10.0.0.1, 172.16.0.2 ",
    "x-real-ip": "198.51.100.5",
  });
  assert.equal(extractClientIpFromHeaders(forwardedHeaders), "203.0.113.10");

  const realIpHeaders = new Headers({
    "x-forwarded-for": "unknown",
    "x-real-ip": " 198.51.100.5 ",
  });
  assert.equal(extractClientIpFromHeaders(realIpHeaders), "198.51.100.5");

  const emptyHeaders = new Headers();
  assert.equal(extractClientIpFromHeaders(emptyHeaders), null);
  assert.equal(extractClientIpFromHeaders(null), null);
  assert.equal(extractClientIpFromHeaders(undefined), null);
});

test("hashIpAddress is deterministic, non-raw SHA-256 hex, and handles empty inputs", () => {
  const rawIp = "203.0.113.10";
  const hashA = hashIpAddress(rawIp);
  const hashB = hashIpAddress(" 203.0.113.10 ");

  assert.equal(hashA, hashB);
  assert.notEqual(hashA, rawIp);
  assert.match(hashA, /^[a-f0-9]{64}$/);
  assert.notEqual(hashIpAddress("203.0.113.11"), hashA);
  assert.equal(hashIpAddress(""), null);
  assert.equal(hashIpAddress(null), null);
  assert.equal(hashIpAddress(undefined), null);
});
