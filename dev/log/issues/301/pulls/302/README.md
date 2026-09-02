# Issue #301 — evidence and analysis

Working folder for [issue #301](https://github.com/link-assistant/agent/issues/301)
("Check for all false positives, false negatives, warnings and errors in CI/CD
and fix them all") and [pull request #302](https://github.com/link-assistant/agent/pull/302).

Everything in this folder is raw evidence downloaded from GitHub plus the
analysis derived from it. Nothing here is shipped in the npm package or the
crate; it exists so the next person can re-check every claim the pull request
makes without re-running the pipeline.

## Contents

| Path | What it is |
| --- | --- |
| [`ci-logs/`](ci-logs) | Full `gh run view --log` output for the failing and reference runs |
| [`meta/`](meta) | `gh run view --json` job/step metadata and per-run summaries |
| [`timeline.md`](timeline.md) | Sequence of events reconstructed from the logs and git history |
| [`requirements.md`](requirements.md) | Every requirement of the issue, enumerated, with status |
| [`root-causes.md`](root-causes.md) | Each defect: symptom → evidence → root cause → fix |
| [`solution-plans.md`](solution-plans.md) | The options considered per requirement and why one was chosen |
| [`existing-components.md`](existing-components.md) | Off-the-shelf tools surveyed and adopted/rejected |
| [`open-findings.md`](open-findings.md) | Findings deliberately not fixed here, with reasoning |

## How the evidence was collected

```bash
RUN=33551125228
gh run view "$RUN" --repo link-assistant/agent --log             > ci-logs/js-cicd-$RUN.log
gh run view "$RUN" --repo link-assistant/agent --log-failed      > ci-logs/js-cicd-$RUN-failed.log
gh run view "$RUN" --repo link-assistant/agent \
  --json conclusion,createdAt,displayTitle,headSha,jobs          > meta/run-$RUN.json

# The most recent successful Release job, for a before/after comparison of the
# same steps that failed above.
gh run view 31466957921 --repo link-assistant/agent --log        > ci-logs/release-job-31466957921-success.log

# The three preceding failures on the default branch, to tell a one-off from a
# recurring failure mode.
for R in 30572373896 30236123719 28688932169; do
  gh run view "$R" --repo link-assistant/agent --log-failed      > ci-logs/run-$R-failed.log
  gh run view "$R" --repo link-assistant/agent                   > meta/run-$R-summary.txt
done
```

`.gitignore` has a generic `*.log` / `ci-logs/` rule; line 152 (`!dev/log/**`)
re-includes this tree so the evidence is versioned with the analysis.
