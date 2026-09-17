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
| *(none)* | build (default) | pilot-default |

Priority order: security > db > frontend > docs. If any routing label already
exists (manual choice), nothing is changed.

## Install in a repository

Add `.github/workflows/auto-label.yml`:

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
