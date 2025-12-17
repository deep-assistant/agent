import z from 'zod';
import { Global } from '../global';
import { Log } from '../util/log';
import path from 'path';
import { NamedError } from '../util/error';
import { readableStreamToText } from 'bun';
import { Flag } from '../flag/flag';

export namespace BunProc {
  const log = Log.create({ service: 'bun' });

  export async function run(
    cmd: string[],
    options?: Bun.SpawnOptions.OptionsObject<any, any, any>
  ) {
    log.info('running', {
      cmd: [which(), ...cmd],
      ...options,
    });
    const result = Bun.spawn([which(), ...cmd], {
      ...options,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: '1',
      },
    });
    const code = await result.exited;
    const stdout = result.stdout
      ? typeof result.stdout === 'number'
        ? result.stdout
        : await readableStreamToText(result.stdout)
      : undefined;
    const stderr = result.stderr
      ? typeof result.stderr === 'number'
        ? result.stderr
        : await readableStreamToText(result.stderr)
      : undefined;
    log.info('done', {
      code,
      stdout,
      stderr,
    });
    if (code !== 0) {
      const parts = [`Command failed with exit code ${result.exitCode}`];
      if (stderr) parts.push(`stderr: ${stderr}`);
      if (stdout) parts.push(`stdout: ${stdout}`);
      throw new Error(parts.join('\n'));
    }
    return result;
  }

  export function which() {
    return process.execPath;
  }

  export const InstallFailedError = NamedError.create(
    'BunInstallFailedError',
    z.object({
      pkg: z.string(),
      version: z.string(),
      details: z.string().optional(),
    })
  );

  export async function install(pkg: string, version = 'latest') {
    const mod = path.join(Global.Path.cache, 'node_modules', pkg);
    const pkgjson = Bun.file(path.join(Global.Path.cache, 'package.json'));
    const parsed = await pkgjson.json().catch(async () => {
      const result = { dependencies: {} };
      await Bun.write(pkgjson.name!, JSON.stringify(result, null, 2));
      return result;
    });
    if (parsed.dependencies[pkg] === version) return mod;

    // Check for dry-run mode
    if (Flag.OPENCODE_DRY_RUN) {
      log.info(
        '[DRY RUN] Would install package (skipping actual installation)',
        {
          pkg,
          version,
          targetPath: mod,
        }
      );
      // In dry-run mode, pretend the package is installed
      return mod;
    }

    // Build command arguments
    const args = [
      'add',
      '--force',
      '--exact',
      '--cwd',
      Global.Path.cache,
      pkg + '@' + version,
    ];

    // Let Bun handle registry resolution:
    // - If .npmrc files exist, Bun will use them automatically
    // - If no .npmrc files exist, Bun will default to https://registry.npmjs.org
    // - No need to pass --registry flag
    log.info("installing package using Bun's default registry resolution", {
      pkg,
      version,
    });

    await BunProc.run(args, {
      cwd: Global.Path.cache,
    }).catch((e) => {
      log.error('package installation failed', {
        pkg,
        version,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      throw new InstallFailedError(
        { pkg, version, details: e instanceof Error ? e.message : String(e) },
        {
          cause: e,
        }
      );
    });
    log.info('package installed successfully', { pkg, version });
    parsed.dependencies[pkg] = version;
    await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2));
    return mod;
  }
}
