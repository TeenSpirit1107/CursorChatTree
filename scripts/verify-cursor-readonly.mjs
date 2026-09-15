#!/usr/bin/env node
/**
 * Static check: Cursor DB / Cursor home reads go through readOnlyCursorData.ts only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');
const gateway = path.join(srcRoot, 'cursor', 'readOnlyCursorData.ts');

const violations = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.name.endsWith('.ts')) {
      continue;
    }
    if (full === gateway) {
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    if (/execFileSync\s*\(\s*['"]sqlite3['"]/.test(text)) {
      violations.push(`${path.relative(repoRoot, full)}: sqlite3 must only run in readOnlyCursorData.ts`);
    }
    if (/from\s+['"]fs['"]/.test(text) && /CursorStorageReader|cursorStoragePoll|CursorPaths/.test(full)) {
      // CursorPaths is re-export only; allow no fs there
    }
    if (full.includes(`${path.sep}parser${path.sep}CursorStorageReader.ts`) && /\bfrom 'fs'\b/.test(text)) {
      violations.push(`${path.relative(repoRoot, full)}: use readOnlyCursorData instead of fs`);
    }
    if (full.includes(`${path.sep}sync${path.sep}cursorStoragePoll.ts`) && /\bfrom 'fs'\b/.test(text)) {
      violations.push(`${path.relative(repoRoot, full)}: use readOnlyCursorData instead of fs`);
    }
  }
}

walk(srcRoot);

if (violations.length > 0) {
  console.error('Cursor read-only verification failed:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}

console.log('Cursor read-only verification passed.');
