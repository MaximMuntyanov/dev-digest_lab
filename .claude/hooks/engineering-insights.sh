#!/usr/bin/env bash
# Stop hook: auto-append engineering insights after each Claude session.
# Captures a timestamped entry in engineering-insights-research.md with
# a summary of what was worked on and key learnings.

set -euo pipefail

INSIGHTS_FILE="$(git rev-parse --show-toplevel)/engineering-insights-research.md"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")

# Only append if the file exists (the student created it as part of lesson-1)
if [ ! -f "$INSIGHTS_FILE" ]; then
  exit 0
fi

# Capture recent git activity as context for the entry
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "no commits")
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null | head -10 || echo "no changes")

cat >> "$INSIGHTS_FILE" << EOF

---

## Session log — $TIMESTAMP

### Recent commits
\`\`\`
$RECENT_COMMITS
\`\`\`

### Changed files
\`\`\`
$CHANGED_FILES
\`\`\`

### Key learnings
<!-- Fill in after reviewing the session -->

EOF

echo "engineering-insights: appended session entry at $TIMESTAMP"
