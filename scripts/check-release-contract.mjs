import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// changesets/action v2 consumes CHANGESETS_OUTPUT, not human-readable CLI logs.
// Generate real CLI events using local tags; never publish or push anything.
const require = createRequire(import.meta.url);
const cli = require.resolve('@changesets/cli/bin.js');
const cwd = mkdtempSync(join(tmpdir(), 'csrf-release-contract-'));
const run = (command, args, env = process.env) =>
  execFileSync(command, args, { cwd, env, stdio: 'pipe' });

try {
  mkdirSync(join(cwd, 'packages/example'), { recursive: true });
  mkdirSync(join(cwd, '.changeset'));
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'release-contract',
      private: true,
      packageManager: 'pnpm@10.2.1',
    })
  );
  writeFileSync(
    join(cwd, 'pnpm-workspace.yaml'),
    'packages:\n  - packages/*\n'
  );
  writeFileSync(
    join(cwd, 'packages/example/package.json'),
    JSON.stringify({
      name: '@csrf-armor/release-contract',
      version: '1.0.0',
    })
  );
  writeFileSync(
    join(cwd, '.changeset/config.json'),
    JSON.stringify({
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: 'public',
      baseBranch: 'main',
      updateInternalDependencies: 'patch',
      ignore: [],
    })
  );
  run('git', ['init', '--initial-branch=main']);
  run('git', ['config', 'user.name', 'Release contract test']);
  run('git', ['config', 'user.email', 'release-test@example.invalid']);
  // These unsigned commits/tags exist only in this disposable local fixture.
  run('git', ['config', 'commit.gpgsign', 'false']);
  run('git', ['config', 'tag.gpgsign', 'false']);
  run('git', ['add', '.']);
  run('git', ['commit', '-m', 'Release contract fixture']);

  for (const [filename, expected] of [
    [
      'first.ndjson',
      [
        {
          type: 'git-tag',
          tag: '@csrf-armor/release-contract@1.0.0',
          packageName: '@csrf-armor/release-contract',
        },
      ],
    ],
    ['repeat.ndjson', []],
  ]) {
    const output = join(cwd, filename);
    run(process.execPath, [cli, 'git-tag'], {
      ...process.env,
      CHANGESETS_OUTPUT: output,
    });
    const events = readFileSync(output, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    assert.deepEqual(events, expected);
  }
  console.log(
    'Release contract passed: new tags produce action-v2 events; repeated tags produce none.'
  );
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
