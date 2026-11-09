#!/usr/bin/env bash
# Auto-save: commits every change in the project to git at the end of each
# Claude Code turn, so any earlier state can be restored with git.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

git add -A
if ! git diff --cached --quiet; then
  files=$(git diff --cached --name-only)
  count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')
  summary=$(printf '%s\n' "$files" | head -5 | paste -sd ', ' -)
  [ "$count" -gt 5 ] && summary="$summary, +$((count - 5)) more"
  git commit -q -m "Auto-save $(date '+%Y-%m-%d %H:%M'): $summary" -m "$files"
fi

# Push to GitHub whenever local is ahead (also catches up after an earlier
# failed push, or commits you made yourself). Never fails the hook.
git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1 || exit 0
[ "$(git rev-list --count '@{u}..HEAD')" -gt 0 ] || exit 0
if ! err=$(timeout 25 git push -q 2>&1); then
  msg="Auto-save committed locally, but git push failed: ${err:-timed out}"
  printf '{"systemMessage": %s}\n' "$(printf '%s' "$msg" | jq -Rs .)"
fi
exit 0
