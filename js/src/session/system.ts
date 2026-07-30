import { Ripgrep } from '../file/ripgrep';
import { Global } from '../global';
import { Filesystem } from '../util/filesystem';
import { Config } from '../config/file-config';
import { config as runtimeConfig } from '../config/config';

import { Instance } from '../project/instance';
import path from 'path';
import os from 'os';

import PROMPT_ANTHROPIC from './prompt/anthropic.txt';
import PROMPT_ANTHROPIC_WITHOUT_TODO from './prompt/qwen.txt';
import PROMPT_POLARIS from './prompt/polaris.txt';
import PROMPT_BEAST from './prompt/beast.txt';
import PROMPT_GEMINI from './prompt/gemini.txt';
import PROMPT_ANTHROPIC_SPOOF from './prompt/anthropic_spoof.txt';
import PROMPT_SUMMARIZE from './prompt/summarize.txt';
import PROMPT_TITLE from './prompt/title.txt';
import PROMPT_CODEX from './prompt/codex.txt';
import PROMPT_GROK_CODE from './prompt/grok-code.txt';
import { Branding } from '../branding';
import { Log } from '../util/log';

export namespace SystemPrompt {
  const log = Log.create({ service: 'system-prompt' });

  export function header(providerID: string) {
    if (providerID.includes('anthropic'))
      return [PROMPT_ANTHROPIC_SPOOF.trim()];
    return [];
  }

  /** Identifiers of the selectable system prompts. */
  export type PromptID =
    | 'anthropic'
    | 'anthropic-without-todo'
    | 'beast'
    | 'codex'
    | 'gemini'
    | 'grok-code'
    | 'polaris';

  const RAW: Record<PromptID, string> = {
    anthropic: PROMPT_ANTHROPIC,
    'anthropic-without-todo': PROMPT_ANTHROPIC_WITHOUT_TODO,
    beast: PROMPT_BEAST,
    codex: PROMPT_CODEX,
    gemini: PROMPT_GEMINI,
    'grok-code': PROMPT_GROK_CODE,
    polaris: PROMPT_POLARIS,
  };

  /**
   * The prompt used for any model that is not matched by an explicit rule.
   * It is the full prompt (with todo/task-tracking discipline); models that
   * genuinely break on todo tools must opt out explicitly via the
   * `AGENT_SYSTEM_PROMPT` environment variable. See issue #285.
   */
  export const DEFAULT_PROMPT_ID: PromptID = 'anthropic';

  const RULES: { matches: (modelID: string) => boolean; id: PromptID }[] = [
    { matches: (m) => m.includes('gpt-5'), id: 'codex' },
    {
      matches: (m) =>
        m.includes('gpt-') || m.includes('o1') || m.includes('o3'),
      id: 'beast',
    },
    { matches: (m) => m.includes('gemini-'), id: 'gemini' },
    { matches: (m) => m.includes('claude'), id: 'anthropic' },
    { matches: (m) => m.includes('polaris-alpha'), id: 'polaris' },
    { matches: (m) => m.includes('grok-code'), id: 'grok-code' },
  ];

  export function isPromptID(value: string): value is PromptID {
    return value in RAW;
  }

  /**
   * Resolve which prompt a model gets, and why.
   *
   * Resolution order:
   * 1. explicit override via the `AGENT_SYSTEM_PROMPT` environment variable;
   * 2. an explicit rule matching the model id;
   * 3. {@link DEFAULT_PROMPT_ID}.
   */
  export function resolve(modelID: string): { id: PromptID; reason: string } {
    const override = process.env['AGENT_SYSTEM_PROMPT']?.trim();
    if (override) {
      if (isPromptID(override))
        return { id: override, reason: 'AGENT_SYSTEM_PROMPT override' };
      log.warn(() => ({
        message: 'unknown AGENT_SYSTEM_PROMPT value, ignoring',
        value: override,
        known: Object.keys(RAW),
      }));
    }
    for (const rule of RULES) {
      if (rule.matches(modelID))
        return { id: rule.id, reason: `matched model id ${modelID}` };
    }
    return {
      id: DEFAULT_PROMPT_ID,
      reason: `default for unknown model ${modelID}`,
    };
  }

  /** Get a prompt by id, with the product identity substituted in (#285). */
  export function text(id: PromptID): string {
    return Branding.apply(RAW[id]);
  }

  export function provider(modelID: string) {
    const resolved = resolve(modelID);
    log.info(() => ({
      message: `system prompt: ${resolved.id} (${resolved.reason})`,
      prompt: resolved.id,
      model: modelID,
    }));
    return [text(resolved.id)];
  }

  export async function environment() {
    const project = Instance.project;
    const readOnlyNote = runtimeConfig.readOnly
      ? [
          ``,
          `<read_only_mode>`,
          `  You are running in read-only / planning mode. Tools that modify the`,
          `  filesystem or execute shell commands (bash, edit, write, multiedit,`,
          `  patch) are disabled and will be rejected if attempted. You may only`,
          `  read, search, and plan. Describe the changes you would make instead`,
          `  of attempting to apply them.`,
          `</read_only_mode>`,
        ].join('\n')
      : '';
    return [
      [
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === 'git' ? 'yes' : 'no'}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        readOnlyNote,
        `<files>`,
        `  ${
          project.vcs === 'git'
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 200,
              })
            : ''
        }`,
        `</files>`,
      ].join('\n'),
    ];
  }

  const LOCAL_RULE_FILES = [
    'AGENTS.md',
    'CLAUDE.md',
    'CONTEXT.md', // deprecated
  ];
  const GLOBAL_RULE_FILES = [
    path.join(Global.Path.config, 'AGENTS.md'),
    path.join(os.homedir(), '.claude', 'CLAUDE.md'),
  ];

  export async function custom() {
    const config = await Config.get();
    const paths = new Set<string>();

    for (const localRuleFile of LOCAL_RULE_FILES) {
      const matches = await Filesystem.findUp(
        localRuleFile,
        Instance.directory,
        Instance.worktree
      );
      if (matches.length > 0) {
        matches.forEach((path) => paths.add(path));
        break;
      }
    }

    for (const globalRuleFile of GLOBAL_RULE_FILES) {
      if (await Bun.file(globalRuleFile).exists()) {
        paths.add(globalRuleFile);
        break;
      }
    }

    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith('~/')) {
          instruction = path.join(os.homedir(), instruction.slice(2));
        }
        let matches: string[] = [];
        if (path.isAbsolute(instruction)) {
          matches = await Array.fromAsync(
            new Bun.Glob(path.basename(instruction)).scan({
              cwd: path.dirname(instruction),
              absolute: true,
              onlyFiles: true,
            })
          ).catch(() => []);
        } else {
          matches = await Filesystem.globUp(
            instruction,
            Instance.directory,
            Instance.worktree
          ).catch(() => []);
        }
        matches.forEach((path) => paths.add(path));
      }
    }

    const found = Array.from(paths).map((p) =>
      Bun.file(p)
        .text()
        .catch(() => '')
        .then((x) => 'Instructions from: ' + p + '\n' + x)
    );
    return Promise.all(found).then((result) => result.filter(Boolean));
  }

  export function summarize(providerID: string) {
    switch (providerID) {
      case 'anthropic':
        return [
          PROMPT_ANTHROPIC_SPOOF.trim(),
          Branding.apply(PROMPT_SUMMARIZE),
        ];
      default:
        return [Branding.apply(PROMPT_SUMMARIZE)];
    }
  }

  export function title(providerID: string) {
    switch (providerID) {
      case 'anthropic':
        return [PROMPT_ANTHROPIC_SPOOF.trim(), Branding.apply(PROMPT_TITLE)];
      default:
        return [Branding.apply(PROMPT_TITLE)];
    }
  }
}
