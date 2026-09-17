#!/usr/bin/env bash
# GitHub triage snapshot for next-slice
# Runs all API calls in parallel — one shot to get the full picture

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) || {
  echo "ERROR: Not in a GitHub repo or 'gh' not authenticated" >&2
  exit 1
}

_m=$(mktemp) _i=$(mktemp) _c=$(mktemp) _p=$(mktemp) _g=$(mktemp)
trap 'rm -f "$_m" "$_i" "$_c" "$_p" "$_g"' EXIT

# Run all fetches in parallel
gh api "repos/$REPO/milestones?state=open&sort=number&direction=asc" \
  --jq '[.[] | {number, title, open_issues, closed_issues, description}]' > "$_m" &

gh api "repos/$REPO/issues?state=open&per_page=100" \
  --jq '[.[] | select(.labels | map(.name) | contains(["type:epic"]) | not) |
    {number, title, labels: [.labels[].name], milestone: .milestone.title,
     body_preview: (.body // "" | split("\n") | map(select(length > 0)) | .[0:3] | join(" | "))}]' > "$_i" &

gh api "repos/$REPO/issues?state=closed&per_page=10" \
  --jq '[.[] | {number, title, labels: [.labels[].name], milestone: .milestone.title}]' > "$_c" &

gh pr list --state open --json number,title,headRefName,isDraft \
  --jq '[.[] | "#\(.number) \(.title) [\(.headRefName)]\(if .isDraft then " [DRAFT]" else "" end)"]' > "$_p" &

{
  git log --oneline -15
  echo "--- current branch: $(git branch --show-current) ---"
} > "$_g" &

wait

echo "REPO: $REPO"
echo ""
echo "============================================================"
echo "MILESTONES (open, lowest number = active)"
echo "============================================================"
cat "$_m"
echo ""
echo "============================================================"
echo "OPEN ISSUES (non-epic)"
echo "============================================================"
cat "$_i"
echo ""
echo "============================================================"
echo "RECENTLY CLOSED (last 10)"
echo "============================================================"
cat "$_c"
echo ""
echo "============================================================"
echo "OPEN PRs"
echo "============================================================"
cat "$_p"
echo ""
echo "============================================================"
echo "GIT LOG (recent 15)"
echo "============================================================"
cat "$_g"
