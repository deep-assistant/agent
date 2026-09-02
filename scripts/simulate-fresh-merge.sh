#!/usr/bin/env bash
# simulate-fresh-merge.sh
#
# Merge the latest base branch into the checked-out pull request before CI runs
# its checks, so the checks validate the state that will actually land on the
# base branch rather than a stale merge preview.
#
# GitHub builds the `refs/pull/N/merge` ref when the pull request is opened or
# synchronized. Commits pushed to the base branch afterwards are not in it, so
# a pull request can be green while its merge result is broken.
#
# Usage:
#   BASE_REF=main bash scripts/simulate-fresh-merge.sh
#
# Exit code 0 = merge succeeded or was unnecessary, non-zero = merge conflict.
#
# See https://github.com/link-assistant/agent/issues/287 and principle 7 of
# https://github.com/link-assistant/hive-mind/blob/main/docs/CI-CD-BEST-PRACTICES.md

set -euo pipefail

if [ -z "${BASE_REF:-}" ]; then
  echo "::error::BASE_REF is not set; cannot simulate a merge."
  exit 1
fi

# The 41898282+ prefix links the commit to the github-actions[bot]
# account. Without it the merge commit is "unattributed", and a ruleset
# with require_extra_approval_for_unattributed_changes demands a human
# approval before an automated pull request can be merged.
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git config user.name "github-actions[bot]"

git fetch origin "$BASE_REF"

BEHIND_COUNT=$(git rev-list --count "HEAD..origin/$BASE_REF")

if [ "$BEHIND_COUNT" -eq 0 ]; then
  echo "Checkout already contains every commit of $BASE_REF; no merge needed."
  exit 0
fi

echo "$BASE_REF has $BEHIND_COUNT commit(s) that are not in this checkout."
echo "Merging them so the checks below run on the real merge result."

if git merge "origin/$BASE_REF" --no-edit; then
  echo "Fresh merge simulation succeeded."
else
  echo "::error::Merge conflict with $BASE_REF. Update the branch before merging."
  exit 1
fi
