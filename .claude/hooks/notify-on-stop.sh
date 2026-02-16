#!/bin/bash
# Stop hook: notify user that Claude has finished
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "Claude Code has finished working" \
  -H "Title: Claude Code" \
  -H "Priority: default" > /dev/null 2>&1

osascript -e 'display notification "Claude Code has finished" with title "Claude Code"' 2>/dev/null

exit 0
