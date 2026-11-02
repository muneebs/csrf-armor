import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

// Follow the same dependency chain used by the Nuxt/Nitro archive tooling.
let requireFrom = createRequire(new URL('../examples/nuxt-app/package.json', import.meta.url));
for (const pkg of ['nuxt', '@nuxt/nitro-server', 'nitropack', 'archiver', 'archiver-utils']) {
  requireFrom = createRequire(requireFrom.resolve(`${pkg}/package.json`));
}
const { file } = requireFrom('archiver-utils');
const globRequire = createRequire(requireFrom.resolve('glob/package.json'));
const minimatchRoot = path.dirname(globRequire.resolve('minimatch/package.json'));

test('minimatch ESM supports brace expansion', async () => {
  const minimatch = await import(pathToFileURL(path.join(minimatchRoot, 'dist/esm/index.js')).href);
  assert.equal(minimatch.minimatch('example.js', '*.{js,ts}'), true);
  assert.equal(minimatch.minimatch('example.css', '*.{js,ts}'), false);
});

test('archiver-utils expands patterns with glob options', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'csrf-armor-glob-'));
  try {
    await mkdir(path.join(cwd, 'nested'));
    await mkdir(path.join(cwd, 'ignored'));
    await writeFile(path.join(cwd, 'nested', 'keep.js'), 'keep');
    await writeFile(path.join(cwd, 'nested', 'skip.txt'), 'skip');
    await writeFile(path.join(cwd, 'ignored', 'skip.js'), 'skip');
    const sorted = (values) => values.map((value) => value.replaceAll('\\', '/')).sort();
    assert.deepEqual(sorted(file.expand({ cwd, nodir: true, ignore: 'ignored/**' }, '**/*.{js,txt}')),
      ['nested/keep.js', 'nested/skip.txt']);
    const ignoredAbsolute = path.join(cwd, 'ignored', '**').replaceAll('\\', '/');
    assert.deepEqual(sorted(file.expand({ cwd, nodir: true, ignore: ignoredAbsolute }, '**/*.js')), ['nested/keep.js']);
    assert.deepEqual(sorted(file.expand({ cwd, mark: true }, 'nested')), ['nested/']);
    const expected = (await realpath(path.join(cwd, 'nested', 'keep.js'))).replaceAll('\\', '/');
    assert.deepEqual(sorted(file.expand({ cwd, absolute: true, realpath: true, nodir: true }, 'nested/*.js')), [expected]);
    const mappings = file.expandMapping(['nested/*.js'], 'out', { cwd });
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].dest, 'out/nested/keep.js');
    assert.equal(mappings[0].src[0], path.join(cwd, 'nested/keep.js').replaceAll('\\', '/'));
    if (process.platform === 'win32') {
      // Native backslash paths are passed as cwd; glob patterns use forward slashes.
      assert.ok(cwd.includes('\\'));
      assert.deepEqual(sorted(file.expand({ cwd, nodir: true }, 'nested/*.js')), ['nested/keep.js']);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
