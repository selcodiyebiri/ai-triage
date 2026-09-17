// Auto-label triage for pilot issues.
//
// Runs inside GitHub Actions on issues (opened/edited/labeled). If the issue
// carries the "pilot" label and has no routing label yet, it classifies the
// issue text and applies exactly one routing label so opencode-pilot can route
// it to the right agent/model source.
//
// Environment (set by the caller workflow):
//   GH_TOKEN        - token with issues:write
//   REPO            - owner/repo
//   ISSUE_NUMBER    - issue number
//   ISSUE_TITLE     - issue title
//   ISSUE_BODY      - issue body
//   ISSUE_LABELS    - comma-separated current labels

const token = process.env.GH_TOKEN;
const repo = process.env.REPO;
const number = process.env.ISSUE_NUMBER;
const title = (process.env.ISSUE_TITLE || "").toLowerCase();
const body = (process.env.ISSUE_BODY || "").toLowerCase();
const labels = (process.env.ISSUE_LABELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ROUTES = [
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

function finish(msg) {
  console.log(msg);
  process.exit(0);
}

if (!labels.includes("pilot")) finish("no pilot label; skipping");
if (!repo || !number) finish("missing REPO or ISSUE_NUMBER; skipping");

const routeLabels = ROUTES.map((r) => r.label);
const existing = routeLabels.filter((l) => labels.includes(l));
if (existing.length) finish(`routing label already present: ${existing.join(",")}`);

const text = `${title}\n${body}`;
let matched = null;
for (const route of ROUTES) {
  if (route.keywords.some((k) => text.includes(k))) {
    matched = route;
    break;
  }
}
if (!matched) finish("no route matched; leaving issue for the default source");

const ensure = await api(`/repos/${repo}/labels`, {
  method: "POST",
  body: JSON.stringify({
    name: matched.label,
    color: matched.color,
    description: "opencode-pilot routing label",
  }),
});
if (!ensure.ok && ensure.status !== 422) {
  console.error(`failed to ensure label ${matched.label}: ${ensure.status}`);
  process.exit(1);
}

const add = await api(`/repos/${repo}/issues/${number}/labels`, {
  method: "POST",
  body: JSON.stringify({ labels: [matched.label] }),
});
if (!add.ok) {
  console.error(`failed to add label ${matched.label}: ${add.status}`);
  process.exit(1);
}
finish(`applied routing label: ${matched.label}`);
