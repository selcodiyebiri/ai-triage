#!/usr/bin/env bash
# Install (or update) the ai-triage auto-label workflow in a repository.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/selcodiyebiri/ai-triage/main/install.sh | bash -s -- owner/repo
#
# Requires: gh CLI, authenticated with repo access to the target repository.

set -euo pipefail

REPO="${1:?usage: install.sh owner/repo}"
WORKFLOW_PATH=".github/workflows/auto-label.yml"
SOURCE_URL="https://raw.githubusercontent.com/selcodiyebiri/ai-triage/main/caller-workflow.yml"

if ! [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "invalid repository: $REPO" >&2
  exit 1
fi

CONTENT="$(curl -fsSL "$SOURCE_URL" | base64 | tr -d '\n')"
SHA="$(gh api "repos/$REPO/contents/$WORKFLOW_PATH" --jq '.sha' 2>/dev/null || true)"

if [ -n "$SHA" ]; then
  gh api "repos/$REPO/contents/$WORKFLOW_PATH" -X PUT \
    -f message="ci: update ai-triage auto-labeling" \
    -f content="$CONTENT" \
    -f sha="$SHA" >/dev/null
  echo "updated $REPO ($WORKFLOW_PATH)"
else
  gh api "repos/$REPO/contents/$WORKFLOW_PATH" -X PUT \
    -f message="ci: enable ai-triage auto-labeling" \
    -f content="$CONTENT" >/dev/null
  echo "installed $REPO ($WORKFLOW_PATH)"
fi
