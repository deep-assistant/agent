#!/usr/bin/env bun
/**
 * Supervise a run and kill it when the agent does not route to the requested model.
 *
 * The agent emits exactly one `model_resolved` event before it sends anything to
 * a provider, so a supervisor can verify routing and terminate the run before a
 * request reaches a model that was not asked for. No log-message parsing.
 *
 * Usage:
 *   bun examples/verify-model-routing.mjs "formalai/formal-ai" "say hi"
 *
 * Exit codes:
 *   0  the agent ran with the requested model
 *   2  the agent resolved a different model (run was terminated)
 *
 * @see https://github.com/link-assistant/agent/issues/295
 * @see docs/model-resolved-event.md
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const requestedModel = process.argv[2] ?? 'opencode/minimax-m2.5-free';
const message = process.argv[3] ?? 'say hi';

const agent = spawn(
  'bun',
  [
    'run',
    new URL('../js/src/index.js', import.meta.url).pathname,
    '--model',
    requestedModel,
    '--output-format',
    'stream-json',
    '--no-always-accept-stdin',
  ],
  { stdio: ['pipe', 'pipe', 'inherit'] }
);

agent.stdin.write(`${message}\n`);
agent.stdin.end();

let sawAttestation = false;
let routingRejected = false;

const lines = createInterface({ input: agent.stdout });

for await (const line of lines) {
  if (!line.trim().startsWith('{')) continue;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }

  // The machine contract: switch on `type`, never on a message string.
  if (event.type === 'model_resolved') {
    sawAttestation = true;
    console.error(
      `[supervisor] requested=${event.requested} resolved=${event.providerID}/${event.modelID} ` +
        `source=${event.source} matchesRequest=${event.matchesRequest}`
    );

    if (!event.matchesRequest) {
      routingRejected = true;
      console.error('[supervisor] wrong model — terminating before any request');
      agent.kill('SIGTERM');
      break;
    }
    continue;
  }

  if (event.type === 'init') {
    // The claude standard reports the resolved model here as well.
    console.error(`[supervisor] session ${event.session_id} on ${event.model}`);
  }
}

if (routingRejected) {
  process.exit(2);
}

if (!sawAttestation) {
  console.error('[supervisor] no model_resolved event — refusing to trust this run');
  process.exit(2);
}

const exitCode = await new Promise((resolve) => agent.on('close', resolve));
process.exit(exitCode ?? 0);
