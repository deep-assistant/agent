# Open findings

Things this pull request deliberately does **not** change, each with the
evidence and the reason. They are recorded so a later iteration does not have
to rediscover them.

## OF1 — `npm warn deprecated node-domexception@1.0.0`

Printed twice per `npm install` (`ci-logs/js-cicd-33551125228.log`, and still
the only `npm warn` left in the green runs on this branch). The chain is
`google-auth-library` → `gaxios@7` → `node-fetch@3.3.2` → `fetch-blob@3.2.0` →
`node-domexception@1.0.0`.

There is no version of that chain without it: `node-fetch` latest is 3.3.2, and
even `fetch-blob@4.0.0` still declares `"node-domexception": "^1.0.0"`
(verified against the registry). An npm `override` could only swap one
deprecated package for the same deprecated package, so the warning cannot be
removed downstream - it needs `fetch-blob` to move to the platform
`DOMException`, which is tracked upstream in
[node-fetch/fetch-blob#175](https://github.com/node-fetch/fetch-blob/issues/175)
("All versions of node-domexception have been deprecated"). No new report filed:
the existing one is open and describes exactly this. Left alone, deliberately.

## OF2 — TypeScript is never type-checked

`npm run check` is `lint && format:check && check:file-size`; there is no
`typecheck` script and no workflow step runs `tsc`. Running
`bun x tsc --noEmit` against `js/tsconfig.json` as committed reports **504
errors**, most of them caused by the config itself: `lib` has no `DOM`, so
`URL`, `Response` and friends are unresolved, and `allowImportingTsExtensions`
is off while the sources import `./x.ts`. With `DOM` added and
`allowImportingTsExtensions`/`noEmit` set, **191 genuine type errors** remain,
and `tsconfig.json` also names a `bun-types` package that is not installed.

This is a real gap - the repository is 53.8% TypeScript and none of it is
checked - but fixing 191 type errors is a change to product code, not to CI,
and would dwarf this pull request. The experiment was reverted so the branch
carries no half-finished typecheck work. Recommended follow-up: a separate
issue that (1) fixes `tsconfig.json` and installs `bun-types`, (2) fixes the
191 errors, (3) adds `typecheck` to `npm run check` and to the lint job.

## OF3 — the push race in the release scripts

`scripts/version-and-commit.mjs:260` and `scripts/rust-version-and-commit.mjs`
finish with a bare `git push origin main`. A rejected push there leaves the
version bump committed in the runner and the release half-done. The templates
solved this with `push-main-with-rebase-retry.mjs` +
`land-via-pull-request.mjs` + `push-failure-classifier.mjs`. No occurrence
appears in the collected logs, and `acb8ea7` already removes the most likely
trigger by putting every `main` writer in one `main-writer-*` concurrency
group. Adoption plan, if it ever bites: copy those three scripts plus
`run-command.mjs`, port their tests to `bun:test`, and replace the two
`git push origin main` calls.

## OF4 — every pull request needs a changeset, including docs-only ones

`scripts/validate-changeset.mjs` requires exactly one changeset per pull
request. The JS template instead gates on `detect-code-changes.mjs`, which
ignores `docs/`, `*.md`, `.changeset/`, `dev/log/`, `experiments/` and
`examples/`. Changing this is a release-policy decision for the repository
owner, not a CI defect, so the stricter local policy is left in place.

## OF5 — no automated dependency updates

RC3 and RC4 were both "an advisory published after the last merge". The new
`security.yml` runs weekly so they now surface within seven days, but nothing
opens the update. Enabling Dependabot or Renovate would close the loop;
choosing the cadence is an owner decision.

## OF6 — `.lycheeignore` entries that are not link rot

Two patterns exist only because the target rejects automated requests, not
because the link is broken: `https://claude\.ai` (403 for non-browser user
agents) and `https://api\.kilo\.ai` (an API base URL, so `GET /` is a 404 by
design). `docs/case-studies` is excluded wholesale, as it is in both templates:
it contains downloaded research material whose links are historical records.
