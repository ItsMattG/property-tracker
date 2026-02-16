#!/bin/bash
# PreCompact hook: reminds Claude what to preserve during compaction
# Output goes to Claude's context before compaction happens

echo "COMPACTION REMINDER — Preserve the following in your summary:"
echo "  1. Current beads task ID (from bd show)"
echo "  2. All files modified in this session"
echo "  3. Current implementation plan file path (if any)"
echo "  4. Any failing test names and their error messages"
echo "  5. The current step number in the plan"
echo "  6. Any decisions made with the user during this session"

exit 0
