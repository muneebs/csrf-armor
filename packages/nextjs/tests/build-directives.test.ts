import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Rolldown warns that module-level directives "may not be preserved" on every
// build. They survive only because tsdown runs with `unbundle: true`, so each
// file keeps its own first line. This guards against a config change that
// merges client modules and silently drops 'use client', which would make
// Next.js treat CsrfProvider as a server component.

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const clientSrc = join(packageRoot, 'src', 'client');
const USE_CLIENT = /^\s*['"]use client['"];?/;

const clientModules = readdirSync(clientSrc)
  .filter((file) => /\.tsx?$/.test(file))
  .filter((file) =>
    USE_CLIENT.test(readFileSync(join(clientSrc, file), 'utf8'))
  );

let outDir: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'csrf-armor-nextjs-build-'));
  execFileSync('pnpm', ['exec', 'tsdown', '--out-dir', outDir], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}, 60_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe("built client modules keep 'use client'", () => {
  it('finds the client modules to check', () => {
    expect(clientModules).toEqual(
      expect.arrayContaining(['client.ts', 'react.tsx'])
    );
  });

  it.each(clientModules)('%s', (file) => {
    const built = readFileSync(
      join(outDir, 'client', file.replace(/\.tsx?$/, '.js')),
      'utf8'
    );
    expect(built).toMatch(USE_CLIENT);
  });
});
