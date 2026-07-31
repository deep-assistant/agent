import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Policy checks for the GitHub Actions workflows.
 *
 * These are executable versions of the rules in
 * https://github.com/link-assistant/hive-mind/blob/main/docs/CI-CD-BEST-PRACTICES.md
 * and docs/BEST-PRACTICES.md of the pipeline templates
 * (link-foundation/js-ai-driven-development-pipeline-template, which enforces
 * the same rules in tests/workflow-permissions.test.js and
 * tests/ci-timeouts.test.js).
 *
 * Each rule below failed on at least one workflow of this repository when the
 * test was written; see https://github.com/link-assistant/agent/issues/287.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowDir = join(repoRoot, '.github', 'workflows');

const workflowFiles = readdirSync(workflowDir)
  .filter((file) => /\.ya?ml$/.test(file))
  .sort();

function readWorkflow(file) {
  return readFileSync(join(workflowDir, file), 'utf8').replaceAll('\r\n', '\n');
}

const workflows = workflowFiles.map((file) => ({
  file,
  body: readWorkflow(file),
}));

/**
 * List the top-level job ids of a workflow.
 * @param {string} body
 * @returns {string[]}
 */
export function listJobs(body) {
  const jobsStart = body.indexOf('\njobs:\n');
  if (jobsStart === -1) {
    return [];
  }
  return Array.from(
    body.slice(jobsStart).matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm),
    (match) => match[1]
  );
}

/**
 * Extract the YAML block belonging to a single job.
 * @param {string} body
 * @param {string} jobId
 * @returns {string}
 */
export function getJobBlock(body, jobId) {
  const lines = body.split('\n');
  const start = lines.indexOf(`  ${jobId}:`);
  if (start === -1) {
    return '';
  }
  const end = lines.findIndex(
    (line, index) => index > start && /^ {2}[a-zA-Z0-9_-]+:\s*$/.test(line)
  );
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

/**
 * Read the `permissions:` block declared at the workflow level.
 * Without one, jobs inherit the repository default, which is often
 * read/write-all for the whole GITHUB_TOKEN.
 * @param {string} body
 * @returns {string|undefined}
 */
export function getTopLevelPermissions(body) {
  const lines = body.split('\n');
  const start = lines.indexOf('permissions:');
  if (start === -1) {
    return undefined;
  }
  const end = lines.findIndex(
    (line, index) => index > start && line !== '' && !line.startsWith('  ')
  );
  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .filter((line) => line.trim() !== '')
    .join('\n');
}

/**
 * Collect every `run:` script body of a workflow, both the inline and the
 * block form.
 * @param {string} body
 * @returns {string[]}
 */
export function listRunScripts(body) {
  const lines = body.split('\n');
  const scripts = [];

  for (let index = 0; index < lines.length; index++) {
    const match =
      lines[index].match(/^(\s*)- ?run: ?(.*)$/) ||
      lines[index].match(/^(\s*)run: ?(.*)$/);
    if (!match) {
      continue;
    }

    const indent = match[1].length;
    const inline = match[2].trim();

    if (
      inline !== '|' &&
      inline !== '>' &&
      inline !== '|-' &&
      inline !== '>-'
    ) {
      scripts.push(inline);
      continue;
    }

    const blockLines = [];
    for (let next = index + 1; next < lines.length; next++) {
      const line = lines[next];
      if (line.trim() !== '' && line.search(/\S/) <= indent) {
        break;
      }
      blockLines.push(line);
    }
    scripts.push(blockLines.join('\n'));
  }

  return scripts;
}

describe('workflow token permissions', () => {
  test('every workflow declares a top-level permissions block', () => {
    const missing = workflows
      .filter(({ body }) => getTopLevelPermissions(body) === undefined)
      .map(({ file }) => file);

    expect(missing).toEqual([]);
  });

  test('the default is read-only repository contents', () => {
    for (const { file, body } of workflows) {
      expect([file, getTopLevelPermissions(body)]).toEqual([
        file,
        '  contents: read',
      ]);
    }
  });
});

describe('CI timeout policy', () => {
  test('every job declares timeout-minutes', () => {
    const missing = [];

    for (const { file, body } of workflows) {
      for (const jobId of listJobs(body)) {
        if (
          !/^ {4}timeout-minutes:\s*\d+\s*$/m.test(getJobBlock(body, jobId))
        ) {
          missing.push(`${file}:${jobId}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test('every workflow defines at least one job', () => {
    for (const { file, body } of workflows) {
      expect([file, listJobs(body).length > 0]).toEqual([file, true]);
    }
  });
});

describe('cancellation propagation', () => {
  // always() still evaluates to true for a cancelled run, so dependent jobs
  // keep running after a cancel. !cancelled() stops the chain.
  // See hive-mind issue #1278.
  test('job conditions use !cancelled() instead of always()', () => {
    const offenders = [];

    for (const { file, body } of workflows) {
      for (const jobId of listJobs(body)) {
        const block = getJobBlock(body, jobId);
        const condition = block.match(/^ {4}if:(.*)$/m)?.[1] ?? '';
        if (condition.includes('always()')) {
          offenders.push(`${file}:${jobId}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('workflow_dispatch input handling', () => {
  // A `${{ inputs.x }}` expression is substituted into the shell script before
  // it runs, so a value containing shell metacharacters is executed as code.
  // Passing the value through env: keeps it as data.
  test('run scripts never interpolate workflow inputs directly', () => {
    const offenders = [];

    for (const { file, body } of workflows) {
      for (const script of listRunScripts(body)) {
        const match = script.match(
          /\$\{\{\s*(?:inputs\.|github\.event\.inputs\.|github\.head_ref)[^}]*\}\}/
        );
        if (match) {
          offenders.push(`${file}: ${match[0]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('per-test timeouts', () => {
  // Without a per-test cap a hung test burns the whole job timeout before
  // reporting anything.
  test('the bun unit test script sets a global test timeout', () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, 'js', 'package.json'), 'utf8')
    );

    expect(packageJson.scripts.test).toContain('--timeout ');
  });
});

describe('checkout hygiene', () => {
  // actions/checkout runs `git init` before any config exists, so every job
  // printed "hint: Using 'master' as the name for the initial branch" into the
  // log. Observed in run 30657021842.
  test('every workflow silences the git default-branch hint', () => {
    const missing = workflows
      .filter(
        ({ body }) => !body.includes('GIT_CONFIG_KEY_0: init.defaultBranch')
      )
      .map(({ file }) => file);

    expect(missing).toEqual([]);
  });
});

describe('concurrency control', () => {
  test('every workflow declares a concurrency group', () => {
    const missing = workflows
      .filter(({ body }) => !/^concurrency:\s*$/m.test(body))
      .map(({ file }) => file);

    expect(missing).toEqual([]);
  });

  // A push to main starts a release. `cancel-in-progress: true` at the
  // workflow level lets the next push cancel it mid-publish, leaving a version
  // bumped and tagged but never published. Only non-main runs may be cancelled.
  test('workflows triggered by push to main never cancel main runs', () => {
    const offenders = workflows
      .filter(({ body }) => /^ {6}- main\s*$/m.test(body))
      .filter(({ body }) => /^ {2}cancel-in-progress: true\s*$/m.test(body))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
