#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptDir, '..');

function runStep(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n[issue-14] ${label}`);
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      stdio: 'inherit',
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${label} failed with exit code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  try {
    await runStep(
      'Run interactive acceptance sweep',
      'node',
      ['interactive-at-runner.mjs'],
      { cwd: path.resolve(repoRoot, 'temp', 'pw-runner') }
    );

    await runStep('Validate acceptance report schema', 'node', [
      'scripts/validate-at-report.mjs',
    ]);

    await runStep('Run strict signoff gate', 'node', [
      'scripts/validate-at-report.mjs',
      '--require-all-pass',
    ]);

    console.log('\n[issue-14] Interactive acceptance workflow complete.');
  } catch (error) {
    console.error(`\n[issue-14] ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
