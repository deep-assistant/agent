import { BashTool } from './bash';
import { EditTool } from './edit';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { ListTool } from './ls';
import { BatchTool } from './batch';
import { ReadTool } from './read';
import { TaskTool } from './task';
import { TodoWriteTool, TodoReadTool } from './todo';
import { WebFetchTool } from './webfetch';
import { WriteTool } from './write';
import { InvalidTool } from './invalid';
import type { Agent } from '../agent/agent';
import { Tool } from './tool';
import { Instance } from '../project/instance';
import { Config } from '../config/file-config';
import { WebSearchTool } from './websearch';
import { CodeSearchTool } from './codesearch';
import { config } from '../config/config';

export namespace ToolRegistry {
  /**
   * Tools that can mutate the filesystem or execute shell commands.
   * These are disabled when read-only / planning mode is active so that the
   * agent can only read, search and plan. This is the native, enforceable
   * counterpart of agent-commander's `--read-only` flag (issue #271).
   */
  export const READ_ONLY_DENIED_TOOLS = [
    'bash',
    'edit',
    'write',
    'multiedit',
    'patch',
  ] as const;

  /**
   * Resolve the set of tool ids that must be denied for the current run.
   *
   * Combines the read-only/planning preset (`config.readOnly`) with any
   * explicit `--disable-tools a,b,c` list. The result is enforced both when
   * exposing tools to the model and when tools are invoked indirectly via the
   * `batch` tool, so the restriction cannot be bypassed.
   */
  export function deniedTools(): Set<string> {
    const denied = new Set<string>();
    if (config.readOnly) {
      for (const id of READ_ONLY_DENIED_TOOLS) denied.add(id);
    }
    const list = config.disableTools ?? '';
    for (const raw of list.split(',')) {
      const id = raw.trim().toLowerCase();
      if (id) denied.add(id);
    }
    return denied;
  }

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[];
    return { custom };
  });

  export async function register(tool: Tool.Info) {
    const { custom } = await state();
    const idx = custom.findIndex((t) => t.id === tool.id);
    if (idx >= 0) {
      custom.splice(idx, 1, tool);
      return;
    }
    custom.push(tool);
  }

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom);
    const config = await Config.get();

    return [
      InvalidTool,
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      ListTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      WebSearchTool,
      CodeSearchTool,
      BatchTool,
      TodoWriteTool,
      TodoReadTool,
      ...custom,
    ];
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id));
  }

  export async function tools(_providerID: string, _modelID: string) {
    const tools = await all();
    const result = await Promise.all(
      tools.map(async (t) => ({
        id: t.id,
        ...(await t.init()),
      }))
    );
    return result;
  }

  export async function enabled(
    _providerID: string,
    _modelID: string,
    agent: Agent.Info
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    // Permission system removed - all tools enabled by default

    return result;
  }
}
