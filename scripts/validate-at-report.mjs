#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const defaultReportPath = path.resolve(process.cwd(), 'temp/at-report.json');
const expectedIds = [
  'AT-001',
  'AT-002',
  'AT-003',
  'AT-004',
  'AT-005',
  'AT-006',
  'AT-007',
  'AT-008',
  'AT-009',
  'AT-010',
  'AT-011',
  'AT-012',
  'AT-013',
  'AT-014',
  'AT-015',
  'AT-016',
  'AT-017',
  'AT-SR-001',
  'SMOKE-UI-ERRORS',
];

function parseArgs(argv) {
  const out = {
    reportPath: defaultReportPath,
    requireAllPass: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report' && argv[i + 1]) {
      out.reportPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--require-all-pass') {
      out.requireAllPass = true;
    }
  }

  return out;
}

function readReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report file not found: ${reportPath}`);
  }

  const raw = fs.readFileSync(reportPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in report file: ${error.message}`);
  }

  return parsed;
}

function validate(report, requireAllPass) {
  const problems = [];

  if (!Array.isArray(report.results)) {
    problems.push('Missing or invalid results array.');
    return { ok: false, problems };
  }

  const countsById = new Map();
  for (const row of report.results) {
    const id = row?.id;
    if (!id) {
      problems.push('Found result row with missing id.');
      continue;
    }
    countsById.set(id, (countsById.get(id) || 0) + 1);
  }

  const missingIds = expectedIds.filter((id) => !countsById.has(id));
  const duplicateIds = Array.from(countsById.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${id}(${count})`);
  const unexpectedIds = Array.from(countsById.keys()).filter((id) => !expectedIds.includes(id));

  if (missingIds.length > 0) {
    problems.push(`Missing expected IDs: ${missingIds.join(', ')}`);
  }
  if (duplicateIds.length > 0) {
    problems.push(`Duplicate IDs: ${duplicateIds.join(', ')}`);
  }
  if (unexpectedIds.length > 0) {
    problems.push(`Unexpected IDs: ${unexpectedIds.join(', ')}`);
  }

  if (typeof report.total !== 'number' || report.total !== report.results.length) {
    problems.push(`Invalid total: expected ${report.results.length}, got ${report.total}`);
  }

  const passCount = report.results.filter((row) => row.status === 'PASS').length;
  const failCount = report.results.filter((row) => row.status === 'FAIL').length;
  const blockedCount = report.results.filter((row) => row.status === 'BLOCKED').length;

  if (typeof report.pass !== 'number' || report.pass !== passCount) {
    problems.push(`Invalid pass count: expected ${passCount}, got ${report.pass}`);
  }
  if (typeof report.fail !== 'number' || report.fail !== failCount) {
    problems.push(`Invalid fail count: expected ${failCount}, got ${report.fail}`);
  }
  if (typeof report.blocked !== 'number' || report.blocked !== blockedCount) {
    problems.push(`Invalid blocked count: expected ${blockedCount}, got ${report.blocked}`);
  }

  if (requireAllPass && (failCount > 0 || blockedCount > 0)) {
    problems.push(`All-pass required but found fail=${failCount}, blocked=${blockedCount}`);
  }

  return {
    ok: problems.length === 0,
    problems,
    summary: {
      total: report.total,
      pass: passCount,
      fail: failCount,
      blocked: blockedCount,
      expectedTotal: expectedIds.length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = readReport(args.reportPath);
  const result = validate(report, args.requireAllPass);

  if (!result.ok) {
    console.error('AT report validation failed.');
    for (const problem of result.problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log('AT report validation passed.');
  console.log(JSON.stringify(result.summary));
}

main();
