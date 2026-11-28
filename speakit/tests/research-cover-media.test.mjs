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
  DEFAULT_RESEARCH_ARTICLES,
  normalizeResearchCoverImageUrl,
} = jiti(resolve(__dirname, "../lib/research.ts"));
const {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
} = jiti(resolve(__dirname, "../lib/adminAuth.ts"));
const { POST: uploadPost } = jiti(
  resolve(__dirname, "../app/api/admin/research-cover-upload/route.ts")
);
const { POST: generatePost } = jiti(
  resolve(__dirname, "../app/api/admin/research-cover-generate/route.ts")
);

test("normalizeResearchCoverImageUrl allows https and relative paths, rejects data/js", () => {
  assert.equal(DEFAULT_RESEARCH_ARTICLES[0].coverImageUrl, null);
  assert.equal(
    normalizeResearchCoverImageUrl("https://abc.public.blob.vercel-storage.com/a.png"),
    "https://abc.public.blob.vercel-storage.com/a.png"
  );
  assert.equal(
    normalizeResearchCoverImageUrl("/research-covers/ef-epi.png"),
    "/research-covers/ef-epi.png"
  );
  assert.equal(normalizeResearchCoverImageUrl("data:image/png;base64,AAA"), null);
  assert.equal(normalizeResearchCoverImageUrl("javascript:alert(1)"), null);
  assert.equal(normalizeResearchCoverImageUrl(""), null);
});

test("cover upload and generate routes reject unauthenticated requests with 401", async () => {
  const { NextRequest } = require("next/server");
  const upRes = await uploadPost(
    new NextRequest("http://localhost:3000/api/admin/research-cover-upload", {
      method: "POST",
    })
  );
  assert.equal(upRes.status, 401);

  const genRes = await generatePost(
    new NextRequest("http://localhost:3000/api/admin/research-cover-generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "modern tech studio" }),
    })
  );
  assert.equal(genRes.status, 401);
});

test("cover upload and generate routes return clear Vietnamese errors when env tokens are missing", async () => {
  const { NextRequest } = require("next/server");
  const token = createAdminSessionToken();
  const prevXkiro = process.env.XKIRO_API_KEY;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.XKIRO_API_KEY;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const genRes = await generatePost(
      new NextRequest("http://localhost:3000/api/admin/research-cover-generate", {
        method: "POST",
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prompt: "modern tech studio" }),
      })
    );
    assert.equal(genRes.status, 503);
    const genBody = await genRes.json();
    assert.equal(genBody.error, "Chưa cấu hình key ảnh, hãy kiểm tra XKIRO_API_KEY");

    const upRes = await uploadPost(
      new NextRequest("http://localhost:3000/api/admin/research-cover-upload", {
        method: "POST",
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${token}`,
        },
      })
    );
    assert.equal(upRes.status, 503);
    const upBody = await upRes.json();
    assert.ok(upBody.error.includes("BLOB_READ_WRITE_TOKEN"));
  } finally {
    if (prevXkiro !== undefined) process.env.XKIRO_API_KEY = prevXkiro;
    if (prevBlob !== undefined) process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});
