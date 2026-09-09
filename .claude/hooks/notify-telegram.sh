#!/bin/bash
# Hook: notify-telegram.sh
# Type: Stop
# Purpose: Send session summary to Telegram on session end

# This hook requires clawdbot to be installed and configured
# It will send a summary message when a coding session ends

# Check if clawdbot is available
if ! command -v clawdbot &> /dev/null; then
  exit 0
fi

# Get session info from environment (if available)
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROJECT_DIR="${PWD##*/}"

# Create summary message
MESSAGE="Session ended: $PROJECT_DIR
Session ID: $SESSION_ID
Time: $(date '+%Y-%m-%d %H:%M')"

# Send via clawdbot if configured
# Uncomment and configure the recipient:
# clawdbot message send --to "YOUR_TELEGRAM_ID" --message "$MESSAGE"

exit 0
