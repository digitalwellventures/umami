/**
 * Post-build cleanup for Scalingo deployment.
 *
 * Umami uses Next.js standalone output mode which bundles all runtime
 * dependencies into .next/standalone/. After build we can remove the
 * top-level node_modules and other build-only artifacts to stay under
 * Scalingo's 1.5 GB image size limit.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function rm(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`  Removed: ${target}`);
  }
}

function dirSize(dir) {
  try {
    const output = execSync(`du -sm "${dir}" 2>/dev/null`, { encoding: 'utf-8' });
    return parseInt(output.split('\t')[0], 10);
  } catch {
    return 0;
  }
}

console.log('\n--- Scalingo post-build cleanup ---\n');

const before = dirSize('.');
console.log(`Size before cleanup: ~${before} MB\n`);

// 1. Remove directories only needed for building / dev
const removeDirs = [
  'cypress',
  '.husky',
  'src',           // source code — already compiled into .next
  'docker',        // Docker-specific files
  'podman',        // Podman-specific files
  'build',         // build artifacts (messages, etc.)
  'db',            // database files (ClickHouse views etc.)
  'node_modules/.cache',
  '.next/cache',   // Next.js build cache (not needed at runtime)
];

for (const dir of removeDirs) {
  rm(dir);
}

// 2. Remove heavy dev-only node_modules packages
const heavyDevPackages = [
  '@biomejs',
  '@rollup',
  'rollup',
  'cypress',
  'typescript',
  'ts-jest',
  'ts-node',
  'tsup',
  'tsx',
  'jest',
  'husky',
  'lint-staged',
  'stylelint',
  'stylelint-config-css-modules',
  'stylelint-config-prettier',
  'stylelint-config-recommended',
  'postcss',
  'postcss-flexbugs-fixes',
  'postcss-import',
  'postcss-preset-env',
  '@types',
  '@svgr',
  'esbuild',
  'prettier',
  'prompts',
  'extract-react-intl-messages',
  'rollup-plugin-copy',
  'rollup-plugin-delete',
  'rollup-plugin-dts',
  'rollup-plugin-node-externals',
  'rollup-plugin-peer-deps-external',
  'rollup-plugin-postcss',
  'babel-plugin-react-compiler',
  'cross-env',
];

console.log('\nRemoving heavy dev packages from node_modules...');
for (const pkg of heavyDevPackages) {
  const pkgPath = path.join('node_modules', pkg);
  rm(pkgPath);
  // Also check .pnpm
  const pnpmPath = path.join('node_modules', '.pnpm', pkg);
  if (fs.existsSync(pnpmPath)) {
    rm(pnpmPath);
  }
}

// 3. Remove source maps
console.log('\nRemoving source maps...');
try {
  execSync('find node_modules -name "*.map" -type f -delete 2>/dev/null', { stdio: 'pipe' });
  console.log('  Removed *.map files from node_modules');
} catch {
  // ignore errors
}

// 4. Remove TypeScript declaration files from node_modules
console.log('\nRemoving .d.ts files...');
try {
  execSync('find node_modules -name "*.d.ts" -type f -delete 2>/dev/null', { stdio: 'pipe' });
  console.log('  Removed *.d.ts files from node_modules');
} catch {
  // ignore errors
}

// 5. Remove README, LICENSE, CHANGELOG etc. from node_modules
console.log('\nRemoving docs from node_modules...');
try {
  execSync('find node_modules -maxdepth 3 \\( -name "README*" -o -name "CHANGELOG*" -o -name "HISTORY*" -o -name "LICENSE*" -o -name "LICENCE*" -o -name "*.md" \\) -type f -delete 2>/dev/null', { stdio: 'pipe' });
  console.log('  Removed documentation files');
} catch {
  // ignore errors
}

// 6. Remove .pnpm store metadata and unused hoisted packages
console.log('\nCleaning pnpm store...');
try {
  // Remove pnpm patch commit hashes and lock metadata
  execSync('find node_modules/.pnpm -name "*.tgz" -type f -delete 2>/dev/null', { stdio: 'pipe' });
  // Remove test directories inside node_modules
  execSync('find node_modules -type d \\( -name "test" -o -name "tests" -o -name "__tests__" -o -name "example" -o -name "examples" -o -name "docs" -o -name "doc" \\) -exec rm -rf {} + 2>/dev/null', { stdio: 'pipe' });
  console.log('  Cleaned pnpm store and test directories');
} catch {
  // ignore errors
}

const after = dirSize('.');
console.log(`\nSize after cleanup: ~${after} MB`);
console.log(`Saved: ~${before - after} MB`);
console.log('\n--- Cleanup complete ---\n');
