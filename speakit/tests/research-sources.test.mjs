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
  CATEGORY_FEED_SPECS,
  parseFeedXml,
  selectFreshDiverseSources,
  buildDiverseFallbackSynthesis,
  ensureUniqueHeadline,
} = jiti(resolve(__dirname, "../lib/research-sources.ts"));

test("CATEGORY_FEED_SPECS configures multiple reputable feeds per category", () => {
  for (const cat of ["tech_news", "hr_interview", "benchmark", "case_study"]) {
    const spec = CATEGORY_FEED_SPECS[cat];
    assert.ok(spec, `Missing spec for ${cat}`);
    assert.ok(
      spec.rssFeeds.length >= 3,
      `${cat} should have at least 3 reputable RSS/Atom feeds`
    );
    assert.ok(spec.devToTags.length >= 3, `${cat} should rotate devToTags`);
  }
});

test("parseFeedXml parses RSS 2.0 and Atom 1.0 feeds cleanly without HTML noise", () => {
  const rss = `
    <rss version="2.0"><channel>
      <item>
        <title><![CDATA[Scaling CI/CD &amp; Runners]]></title>
        <link>https://github.blog/engineering/scaling-ci/</link>
        <description><![CDATA[<p>How we reduced build latency by <strong>40%</strong>.</p>]]></description>
      </item>
    </channel></rss>
  `;
  const rssItems = parseFeedXml(rss, "GitHub Engineering", 5);
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0].title, "Scaling CI/CD & Runners");
  assert.equal(rssItems[0].url, "https://github.blog/engineering/scaling-ci/");
  assert.match(rssItems[0].excerpt, /How we reduced build latency by 40%/);

  const atom = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Benchmarking Code LLMs</title>
        <link rel="alternate" href="https://arxiv.org/abs/2611.00001" />
        <summary>Empirical comparison of reasoning latency.</summary>
      </entry>
    </feed>
  `;
  const atomItems = parseFeedXml(atom, "arXiv CS", 5);
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0].url, "https://arxiv.org/abs/2611.00001");
  assert.equal(atomItems[0].provider, "arXiv CS");
});

test("selectFreshDiverseSources excludes already-used URLs and balances across providers", () => {
  const existing = [
    {
      title: "Tech & AI News: Long Live Rails",
      sourceUrls: [
        { title: "Dev.to: Long Live Rails", url: "https://dev.to/rails/long-live-rails?utm_source=rss" },
      ],
    },
  ];

  const candidates = [
    { title: "Long Live Rails", url: "https://dev.to/rails/long-live-rails", excerpt: "Old", provider: "Dev.to" },
    { title: "Dev.to New Post", url: "https://dev.to/new/post-2", excerpt: "Fresh dev", provider: "Dev.to" },
    { title: "GitHub Copilot Agents", url: "https://github.blog/copilot-agents/", excerpt: "Fresh GH", provider: "GitHub Blog" },
    { title: "InfoQ Platform Eng", url: "https://infoq.com/news/platform-eng", excerpt: "Fresh InfoQ", provider: "InfoQ" },
    { title: "Lobsters Systems Talk", url: "https://lobste.rs/s/abc123", excerpt: "Fresh Lobsters", provider: "Lobsters" },
  ];

  const picked = selectFreshDiverseSources(candidates, existing, 4);
  assert.equal(picked.length, 4);
  assert.ok(!picked.some((p) => p.url.includes("long-live-rails")), "Duplicate URL must be skipped");

  const providers = new Set(picked.map((p) => p.provider));
  assert.equal(providers.size, 4, "Should diversify across all 4 distinct providers");
});

test("buildDiverseFallbackSynthesis and ensureUniqueHeadline never emit identical titles across runs", () => {
  const sourcesA = [
    { title: "GitHub Copilot Workspace", url: "https://github.blog/a", excerpt: "Agents in IDE", provider: "GitHub Blog" },
    { title: "OpenAI Safety Update", url: "https://openai.com/b", excerpt: "Model evals", provider: "OpenAI News" },
  ];
  const draftA = buildDiverseFallbackSynthesis("tech_news", sourcesA, []);

  const sourcesB = [
    { title: "InfoQ Microservices Mesh", url: "https://infoq.com/c", excerpt: "Service mesh shifts", provider: "InfoQ" },
  ];
  const draftB = buildDiverseFallbackSynthesis("tech_news", sourcesB, [draftA.title]);

  assert.notEqual(draftA.title, draftB.title);
  assert.notEqual(draftA.summary, draftB.summary);
  assert.notEqual(
    ensureUniqueHeadline(draftA.title, [draftA.title], sourcesB[0]),
    draftA.title
  );
});
