import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

// Follow Nitro's installed dependencies, rather than testing a separate copy.
let requireFrom = createRequire(new URL('../examples/nuxt-app/package.json', import.meta.url));
for (const pkg of ['nuxt', '@nuxt/nitro-server', 'nitropack']) {
  requireFrom = createRequire(requireFrom.resolve(`${pkg}/package.json`));
}
// Archiver 8 exports its entry point, but not package.json. It replaces
// archiver-utils/glob with readdir-glob and a named ZipArchive export.
const archiverEntry = requireFrom.resolve('archiver');
const { ZipArchive } = await import(pathToFileURL(archiverEntry).href);
const archiverRequire = createRequire(archiverEntry);
const readdirEntry = archiverRequire.resolve('readdir-glob');
const { ReaddirGlob } = archiverRequire('readdir-glob');
const readdirRequire = createRequire(readdirEntry);
const minimatchRoot = path.dirname(readdirRequire.resolve('minimatch/package.json'));
const sorted = (values) => values.map((value) => value.replaceAll('\\', '/')).sort();

function expand(cwd, options) {
  return new Promise((resolve, reject) => {
    new ReaddirGlob(cwd, options, (error, matches) => error ? reject(error) : resolve(matches));
  });
}

async function archiveEntries(configure) {
  const archive = new ZipArchive({ store: true });
  const entries = [];
  const chunks = [];
  archive.on('entry', (entry) => entries.push(entry.name));
  archive.on('data', (chunk) => chunks.push(chunk));
  // Treat missing files and other warnings as failures, not silent omissions.
  archive.on('warning', (error) => archive.destroy(error));
  const completed = finished(archive);
  try {
    configure(archive);
    await Promise.all([archive.finalize(), completed]);
    const zip = Buffer.concat(chunks);
    assert.equal(zip.readUInt32LE(0), 0x04034b50, 'emits a ZIP local file header');
    return { names: sorted(entries), zip };
  } finally {
    archive.destroy();
    // Also consume completion if configuration threw before Promise.all.
    await completed.catch(() => {});
  }
}

test('Nitro minimatch ESM supports brace expansion and path escaping', async () => {
  const { minimatch } = await import(pathToFileURL(path.join(minimatchRoot, 'dist/esm/index.js')).href);
  assert.equal(minimatch('example.js', '*.{js,ts}'), true);
  assert.equal(minimatch('example.css', '*.{js,ts}'), false);
  assert.equal(minimatch('nested/keep.js', 'nested\\*.js'), false);
  assert.equal(minimatch('nested/keep.js', 'nested\\*.js', { windowsPathsNoEscape: true }), true);
});

test('Nitro archive tooling preserves glob, path and mapping behavior', { timeout: 30_000 }, async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'csrf-armor-glob-'));
  try {
    await mkdir(path.join(cwd, 'nested'));
    await mkdir(path.join(cwd, 'ignored'));
    await writeFile(path.join(cwd, 'nested', 'keep.js'), 'keep-file-content');
    await writeFile(path.join(cwd, 'nested', 'skip.txt'), 'text-file-content');
    await writeFile(path.join(cwd, 'ignored', 'skip.js'), 'ignored-file-content');
    await writeFile(path.join(cwd, '.hidden'), 'hidden-file-content');

    await t.test('brace patterns and relative ignores reach the ZIP', async () => {
      const result = await archiveEntries((archive) => archive.glob('**/*.{js,txt}', {
        cwd, nodir: true, ignore: 'ignored/**',
      }));
      assert.deepEqual(result.names, ['nested/keep.js', 'nested/skip.txt']);
      assert.ok(result.zip.includes(Buffer.from('keep-file-content')));
      assert.ok(result.zip.includes(Buffer.from('text-file-content')));
      assert.ok(!result.zip.includes(Buffer.from('ignored-file-content')));
    });

    await t.test('ignore patterns are relative, not absolute or rooted', async () => {
      const allJs = ['ignored/skip.js', 'nested/keep.js'];
      // Unlike the removed glob/file.expand API, readdir-glob matches ignores
      // only against relative names. It has no `root` option.
      for (const ignore of [path.join(cwd, 'ignored', '**').replaceAll('\\', '/'), '/ignored/**']) {
        assert.deepEqual(sorted(await expand(cwd, { pattern: '**/*.js', nodir: true, ignore })), allJs);
      }
      assert.deepEqual(sorted(await expand(cwd, { pattern: '**/*.js', nodir: true, ignore: 'ignored/**' })), ['nested/keep.js']);
    });

    await t.test('native cwd, absolute sources and marked directories', async () => {
      if (process.platform === 'win32') assert.ok(cwd.includes('\\'));
      assert.deepEqual(sorted(await expand(cwd, { pattern: 'nested/*.js', nodir: true })), ['nested/keep.js']);
      assert.deepEqual(sorted(await expand(cwd, { pattern: 'nested/', mark: true })), ['nested/']);
      assert.deepEqual(sorted(await expand(cwd, { pattern: 'nested\\*.js', nodir: true })), []);
      // readdir-glob has no realpath option; use a canonical cwd when needed.
      const canonicalCwd = await realpath(cwd);
      assert.deepEqual(sorted(await expand(canonicalCwd, { pattern: 'nested/*.js', absolute: true, nodir: true })),
        [path.join(canonicalCwd, 'nested', 'keep.js').replaceAll('\\', '/')]);
    });

    await t.test('destination prefixes replace removed expandMapping API', async () => {
      const result = await archiveEntries((archive) => archive.glob('nested/*.js', { cwd, nodir: true }, { prefix: 'out' }));
      assert.deepEqual(result.names, ['out/nested/keep.js']);
      assert.ok(result.zip.includes(Buffer.from('keep-file-content')));
    });

    await t.test('Nitro ZIP options include dotfiles and exclude directories', async () => {
      const result = await archiveEntries((archive) => archive.glob('**/*', { cwd, nodir: true, dot: true, follow: true }));
      assert.deepEqual(result.names, ['.hidden', 'ignored/skip.js', 'nested/keep.js', 'nested/skip.txt']);
      assert.ok(result.zip.includes(Buffer.from('hidden-file-content')));
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
