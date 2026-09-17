# ai-triage

Deterministic auto-labeling for opencode-pilot issues.

When an issue has the `pilot` label and no routing label yet, this workflow
classifies the issue title/body and applies exactly one routing label so
opencode-pilot can route it to the right agent and model:

| Label | Routed to | Pilot source |
|---|---|---|
| `security` | security-officer | pilot-security |
| `db` | migrator | pilot-db |
| `frontend` | frontend-ops | pilot-frontend |
| `docs` | docs-agent | pilot-docs |
| `chain` (additive) | chain (full CMA chain) | pilot-chain |
| *(none)* | build (default) | pilot-default |

Priority order for domain labels: security > db > frontend > docs (one domain
label only, respected if already present). `chain` is additive and takes
routing precedence over every domain label: it is applied when the issue text
contains chain phrases ("zincir", "run-chain", "tam zincir",
"planner -> tdd-guide", ...) or when the label is set manually. The `chain`
label makes opencode-pilot run the issue through the full Core CMA chain
(planner -> tdd-guide -> implementation -> code-reviewer -> security-reviewer).

## Install in a repository

One-liner (idempotent; run again to update):

```bash
curl -fsSL https://raw.githubusercontent.com/selcodiyebiri/ai-triage/main/install.sh | bash -s -- owner/repo
```

Or add `.github/workflows/auto-label.yml` manually:

```yaml
name: auto-label
on:
  issues:
    types: [opened, edited, labeled]

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          repository: selcodiyebiri/ai-triage
          path: ai-triage
      - run: node ai-triage/label.mjs
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_LABELS: ${{ join(github.event.issue.labels.*.name, ',') }}
```

No secrets are required per repository; the workflow uses the repo's own
`GITHUB_TOKEN`.

## Keywords

Edit `label.mjs` in this repository to change the keyword lists or priority;
every repository picks up the change on its next run (the caller checks out this
repository on each execution).
