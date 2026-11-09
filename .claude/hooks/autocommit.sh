#!/usr/bin/env bash
# Auto-save: commits every change in the project to git at the end of each
# Claude Code turn, so any earlier state can be restored with git.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

git add -A
git diff --cached --quiet && exit 0   # nothing changed

files=$(git diff --cached --name-only)
count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')
summary=$(printf '%s\n' "$files" | head -5 | paste -sd ', ' -)
[ "$count" -gt 5 ] && summary="$summary, +$((count - 5)) more"

git commit -q -m "Auto-save $(date '+%Y-%m-%d %H:%M'): $summary" -m "$files"
