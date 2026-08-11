/**
 * Machine-readable model routing attestation.
 *
 * The CLI already logs which provider/model it settled on, but that record is
 * discriminated by a free-text `message` ("using explicit provider/model").
 * A consumer that must *verify* routing — for example a supervisor that kills
 * the run when the agent resolves anything other than the requested model —
 * would have to match English prose, so an ordinary reword upstream silently
 * disables a downstream safety check.
 *
 * `model_resolved` is the contract instead: one event per run, emitted on
 * every resolution path (explicit `provider/model`, bare model id and default),
 * before the first `step_start` and before any completion request.
 *
 * @see https://github.com/link-assistant/agent/issues/295
 */

import { output } from './output';

/**
 * Stable `type` of the routing attestation event.
 *
 * This string is a machine contract: consumers switch on it. Never reword it —
 * a change here is a breaking change, unlike a change to any log message.
 */
export const MODEL_RESOLVED_EVENT_TYPE = 'model_resolved';

/**
 * Where the applied model selector came from.
 * - `cli`: the `--model`/`-m` command line argument.
 * - `config`: no CLI flag; an operator-configured default is in effect.
 * - `default`: no CLI flag and no override; the built-in default model.
 */
export type ModelSource = 'cli' | 'config' | 'default';

export interface ModelResolvedDetails {
  /** Raw `--model` value, or `null` when no model was requested. */
  requested: string | null;
  /** Selector actually applied: `requested`, or the effective default. */
  selector: string;
  providerID: string;
  modelID: string;
  source: ModelSource;
  /** ISO timestamp; injectable so tests stay deterministic. */
  timestamp?: string;
}

export interface ModelResolvedEvent extends ModelResolvedDetails {
  type: typeof MODEL_RESOLVED_EVENT_TYPE;
  timestamp: string;
  /**
   * Whether the resolved provider/model satisfies `selector`. `false` means the
   * run is about to talk to a model other than the one that was selected, even
   * when the selector came from a default rather than from `--model`.
   */
  matchesRequest: boolean;
  [key: string]: unknown;
}

/**
 * Does `providerID`/`modelID` satisfy the selector the caller supplied?
 *
 * A selector with a `/` names both provider and model and must match both.
 * A bare selector names only the model, so the resolved provider is free.
 */
export function selectorMatchesModel(
  selector: string,
  providerID: string,
  modelID: string
): boolean {
  if (selector.includes('/')) {
    return selector === `${providerID}/${modelID}`;
  }
  return selector === modelID;
}

/** Build the attestation event without emitting it (pure; used by tests). */
export function buildModelResolvedEvent(
  details: ModelResolvedDetails
): ModelResolvedEvent {
  const { requested, selector, providerID, modelID, source, timestamp } =
    details;
  return {
    type: MODEL_RESOLVED_EVENT_TYPE,
    timestamp: timestamp ?? new Date().toISOString(),
    requested: requested ?? null,
    selector,
    providerID,
    modelID,
    source,
    matchesRequest: selectorMatchesModel(selector, providerID, modelID),
  };
}

/**
 * Emit the attestation on stdout and return the emitted event.
 *
 * @param compact - Force single-line JSON (required for NDJSON streams such as
 *   `--output-format stream-json`); defaults to the global compact setting.
 */
export function outputModelResolved(
  details: ModelResolvedDetails,
  compact?: boolean
): ModelResolvedEvent {
  const event = buildModelResolvedEvent(details);
  output(event, compact);
  return event;
}
