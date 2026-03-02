/**
 * Post-build cleanup for Scalingo deployment.
 *
 * Umami uses Next.js standalone output mode which bundles all runtime
 * dependencies into .next/standalone/. After build we can remove the
 * top-level node_modules and other build-only artifacts to stay under
 * Scalingo's 1.5 GB image size limit.
 *
 * The standalone server (.next/standalone/server.js) has its own
 * node_modules. We only need a few packages for startup scripts
 * (check-db.js, update-tracker.js).
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

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

// 1. Remove the entire top-level node_modules.
// The standalone build in .next/standalone/ has its own bundled node_modules.
console.log('Removing top-level node_modules (standalone has its own)...');
rm('node_modules');

// 2. Remove source/build directories not needed at runtime
const removeDirs = [
  'cypress',
  '.husky',
  'src',
  'docker',
  'podman',
  'build',
  'db',
  '.next/cache',
];
for (const dir of removeDirs) {
  rm(dir);
}

// 3. Install ONLY the minimal packages needed for startup scripts.
// check-db.js needs: dotenv, chalk, semver, prisma, @prisma/adapter-pg, pg
// The generated Prisma client is in ./generated/ (already present from build)
console.log('\nInstalling minimal runtime dependencies...');
try {
  execSync(
    'pnpm add --no-lockfile npm-run-all dotenv chalk semver prisma@6.19.0 @prisma/adapter-pg@6.19.0 pg',
    { stdio: 'inherit' },
  );
  console.log('  Minimal deps installed.');
} catch (e) {
  console.error('  Warning: failed to install minimal deps:', e.message);
}

// 4. Clean up the fresh node_modules
console.log('\nCleaning up minimal node_modules...');
try {
  execSync('find node_modules -name "*.d.ts" -type f -delete 2>/dev/null', { stdio: 'pipe' });
  execSync('find node_modules -name "*.map" -type f -delete 2>/dev/null', { stdio: 'pipe' });
  execSync('find node_modules -type d \\( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "doc" -o -name "example" -o -name "examples" \\) -exec rm -rf {} + 2>/dev/null', { stdio: 'pipe' });
  execSync('find node_modules -maxdepth 3 \\( -name "README*" -o -name "CHANGELOG*" -o -name "*.md" \\) -type f -delete 2>/dev/null', { stdio: 'pipe' });
} catch {
  // ignore
}

const after = dirSize('.');
console.log(`\nSize after cleanup: ~${after} MB`);
console.log(`Saved: ~${before - after} MB`);
console.log('\n--- Cleanup complete ---\n');
