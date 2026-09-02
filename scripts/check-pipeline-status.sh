#!/usr/bin/env bash
# check-pipeline-status.sh
#
# Turn timeout cancellations into visible failures.
#
# GitHub reports a job killed by `timeout-minutes` as *cancelled*, not failed,
# and a workflow whose jobs were all cancelled or skipped still reports success.
# Every downstream job of this pipeline is gated on
# `needs.<job>.result == 'success'`, so a cancelled check silently skips the
# release instead of failing the run - a green pipeline that released nothing.
#
# Usage (from a job with `if: always()` that needs every other job):
#   NEEDS_JSON='${{ toJSON(needs) }}' IS_MAIN=true bash scripts/check-pipeline-status.sh
#
# Exit code 0 = every job succeeded or was legitimately skipped.
#
# See https://github.com/link-assistant/agent/issues/301 and principle 5 of
# https://github.com/link-assistant/hive-mind/blob/main/docs/CI-CD-BEST-PRACTICES.md
set -euo pipefail

: "${NEEDS_JSON:?NEEDS_JSON is required (pass toJSON(needs))}"
IS_MAIN="${IS_MAIN:-false}"

select_by_result() {
  NEEDS_JSON="$NEEDS_JSON" WANT_RESULT="$1" node --input-type=module -e '
    const needs = JSON.parse(process.env.NEEDS_JSON);
    const jobs = Object.entries(needs)
      .filter(([, value]) => value.result === process.env.WANT_RESULT)
      .map(([name]) => name);
    console.log(jobs.join(", "));
  '
}

failed="$(select_by_result failure)"
cancelled="$(select_by_result cancelled)"

echo "Failed jobs:    ${failed:-<none>}"
echo "Cancelled jobs: ${cancelled:-<none>}"

status=0

if [ -n "$failed" ]; then
  echo "::error::Pipeline failed. Failing jobs: ${failed}"
  status=1
fi

if [ -n "$cancelled" ]; then
  if [ "$IS_MAIN" = "true" ]; then
    echo "::error::Pipeline has cancelled jobs on main: ${cancelled}. A job killed by 'timeout-minutes' is reported as cancelled, which would otherwise hide the failure."
    status=1
  else
    echo "::warning::Cancelled jobs: ${cancelled}. On a non-default ref this is usually a superseded run."
  fi
fi

if [ "$status" -eq 0 ]; then
  echo "All required jobs succeeded or were legitimately skipped."
fi

exit "$status"
