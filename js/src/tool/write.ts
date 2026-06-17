import z from 'zod';
import * as path from 'path';
import { Tool } from './tool';
import DESCRIPTION from './write.txt';
import { Instance } from '../project/instance';
import { Permission } from '../permission';

export const WriteTool = Tool.define('write', {
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe('The content to write to the file'),
    filePath: z
      .string()
      .describe(
        'The absolute path to the file to write (must be absolute, not relative)'
      ),
  }),
  async execute(params, ctx) {
    const filepath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(Instance.directory, params.filePath);

    // Permission enforcement (issue #271). Writing is governed by the same
    // `edit` policy as the edit tool: `auto` allows, plan/readonly deny,
    // `ask` emits a JSON permission request.
    await Permission.check({
      type: 'edit',
      title: filepath,
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      callID: ctx.callID,
      metadata: { filePath: filepath },
    });

    const file = Bun.file(filepath);
    const exists = await file.exists();

    // Write the file without permission checks
    await Bun.write(filepath, params.content);

    return {
      title: path.relative(Instance.worktree, filepath),
      metadata: {
        diagnostics: {},
        filepath,
        exists: exists,
      },
      output: '',
    };
  },
});
