// Auto-label triage for pilot issues.
//
// Runs inside GitHub Actions on issues (opened/edited/labeled). If the issue
// carries the "pilot" label:
//
//   1. Domain routing: exactly one of security | db | frontend | docs is
//      applied (priority order) when no domain label exists yet.
//   2. Chain routing (additive): the "chain" label is applied when the issue
//      already carries it, or when the issue text requests the chain
//      ("zincir", "run-chain", ...). The chain label makes opencode-pilot route
//      the issue to the `chain` agent and excludes all other sources.
//
// Environment (set by the caller workflow):
//   GH_TOKEN        - token with issues:write
//   REPO            - owner/repo
//   ISSUE_NUMBER    - issue number
//   ISSUE_TITLE     - issue title
//   ISSUE_BODY      - issue body
//   ISSUE_LABELS    - comma-separated current labels

import { pathToFileURL } from "node:url";

const token = process.env.GH_TOKEN;
const repo = process.env.REPO;
const number = process.env.ISSUE_NUMBER;
const title = process.env.ISSUE_TITLE || "";
const body = process.env.ISSUE_BODY || "";
const labels = (process.env.ISSUE_LABELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DOMAIN_ROUTES = [
  {
    label: "security",
    color: "B60205",
    keywords: [
      "security", "güvenlik", "auth", "kimlik", "token", "secret", "şifre",
      "password", "crypto", "kripto", "hmac", "permission", "yetki",
      "authorization", "vulnerability", "zafiyet", "sanitiz", "injection",
      "xss", "csrf", "rate limit", "rate-limit",
    ],
  },
  {
    label: "db",
    color: "5319E7",
    keywords: [
      "migration", "migrasyon", "schema", "şema", "sql", "postgres",
      "database", "veritabanı", "index", "indeks", "query", "sorgu", "prisma",
    ],
  },
  {
    label: "frontend",
    color: "1D76DB",
    keywords: [
      "frontend", "ui", "ux", "css", "tailwind", "react", "component",
      "bileşen", "layout", "tasarım", "design", "page", "sayfa", "landing",
      "html", "form", "button", "modal", "style", "stil", "animasyon",
    ],
  },
  {
    label: "docs",
    color: "0E8A16",
    keywords: [
      "readme", "documentation", "doküman", "dokuman", "changelog", "guide",
      "rehber", "comment on", "yorum ekle",
    ],
  },
];

const CHAIN_ROUTE = {
  label: "chain",
  color: "6F42C1",
  keywords: [
    "zincir",
    "run-chain",
    "run chain",
    "tam zincir",
    "tüm zincir",
    "planner -> tdd-guide",
    "planner->tdd-guide",
    "planner → tdd-guide",
  ],
};

export function decide(titleText, bodyText, currentLabels) {
  const text = `${titleText}\n${bodyText}`.toLowerCase();
  const domain =
    DOMAIN_ROUTES.find((r) => r.keywords.some((k) => text.includes(k)))?.label ??
    null;
  const chainByLabel = currentLabels.includes("chain");
  const chainByText = CHAIN_ROUTE.keywords.some((k) => text.includes(k));
  return { domain, chain: chainByLabel || chainByText, chainByLabel };
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function ensureLabel(label, color) {
  const res = await api(`/repos/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: label,
      color,
      description: "opencode-pilot routing label",
    }),
  });
  if (!res.ok && res.status !== 422) {
    throw new Error(`failed to ensure label ${label}: ${res.status}`);
  }
}

async function addLabel(label) {
  const res = await api(`/repos/${repo}/issues/${number}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [label] }),
  });
  if (!res.ok) {
    throw new Error(`failed to add label ${label}: ${res.status}`);
  }
}

async function main() {
  if (!labels.includes("pilot")) {
    console.log("no pilot label; skipping");
    return;
  }
  if (!repo || !number) {
    console.log("missing REPO or ISSUE_NUMBER; skipping");
    return;
  }

  const verdict = decide(title, body, labels);
  const existingDomain = DOMAIN_ROUTES.map((r) => r.label).filter((l) =>
    labels.includes(l),
  );
  const applied = [];

  if (!existingDomain.length && verdict.domain) {
    const route = DOMAIN_ROUTES.find((r) => r.label === verdict.domain);
    await ensureLabel(route.label, route.color);
    await addLabel(route.label);
    applied.push(route.label);
  } else if (existingDomain.length) {
    console.log(`domain label already present: ${existingDomain.join(",")}`);
  }

  if (verdict.chain && !verdict.chainByLabel) {
    await ensureLabel(CHAIN_ROUTE.label, CHAIN_ROUTE.color);
    await addLabel(CHAIN_ROUTE.label);
    applied.push(CHAIN_ROUTE.label);
  }

  console.log(
    applied.length ? `applied: ${applied.join(",")}` : "no label applied",
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
