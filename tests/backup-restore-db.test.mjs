/**
 * Backup/restore DB tests for Issue 12.
 * Run: node --test tests/backup-restore-db.test.mjs
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = require(path.join(ROOT, 'db/index.js'));

const SCHEMA_PATH = path.join(ROOT, 'schema.sql');
const FIXTURE_PATH = path.join(ROOT, 'fixtures/sample-course-data.json');

let tmpDir = null;

function openFreshDb() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classbank-backup-test-'));
  db.initializeDatabase({
    userDataPath: tmpDir,
    schemaPath: SCHEMA_PATH,
    fixturePath: FIXTURE_PATH,
  });
}

function closeFreshDb() {
  db.closeDatabase();
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

describe('backup and restore APIs', () => {
  before(openFreshDb);
  after(closeFreshDb);

  test('createBackup stores file and listBackups returns it', () => {
    const created = db.createBackup({ notes: 'test backup' });
    assert.equal(created.ok, true);
    assert.equal(fs.existsSync(created.filePath), true);

    const backups = db.listBackups({ limit: 10 });
    const record = backups.find((entry) => entry.filePath === created.filePath);
    assert.ok(record);
    assert.equal(record.exists, true);
    assert.equal(typeof record.fileSizeBytes, 'number');
  });

  test('restoreBackup requires confirmOverwrite', () => {
    const created = db.createBackup({ notes: 'confirm required' });
    assert.throws(
      () => db.restoreBackup({ filePath: created.filePath }),
      /confirmOverwrite=true/i
    );
  });

  test('restoreBackup fails on missing backup path', () => {
    const missingPath = path.join(tmpDir, 'backups', 'missing-file.sqlite');
    assert.throws(
      () => db.restoreBackup({ filePath: missingPath, confirmOverwrite: true }),
      /does not exist/i
    );
  });

  test('restoreBackup fails for non-sqlite file without mutating current data', () => {
    const createdCourse = db.createCourse({ name: `Invalid restore guard ${Date.now()}` });
    const notDbPath = path.join(tmpDir, 'backups', 'not-a-db.sqlite');
    fs.mkdirSync(path.dirname(notDbPath), { recursive: true });
    fs.writeFileSync(notDbPath, 'not a sqlite db', 'utf8');

    assert.throws(
      () => db.restoreBackup({ filePath: notDbPath, confirmOverwrite: true }),
      /not a readable SQLite database|file is not a database/i
    );

    const courses = db.getCourses();
    assert.ok(courses.some((c) => (c.course_id || c.courseId) === createdCourse.courseId));
  });

  test('restoreBackup fails for schema-mismatched sqlite file', () => {
    const mismatchPath = path.join(tmpDir, 'backups', 'schema-mismatch.sqlite');
    fs.mkdirSync(path.dirname(mismatchPath), { recursive: true });

    const mismatchDb = new Database(mismatchPath);
    try {
      mismatchDb.exec('CREATE TABLE courses (id TEXT PRIMARY KEY, name TEXT);');
    } finally {
      mismatchDb.close();
    }

    assert.throws(
      () => db.restoreBackup({ filePath: mismatchPath, confirmOverwrite: true }),
      /missing required tables/i
    );
  });

  test('restoreBackup restores prior baseline after mutation', () => {
    const baselineCourses = db.getCourses();
    const backup = db.createBackup({ notes: 'baseline restore' });

    const mutated = db.createCourse({ name: `Mutated ${Date.now()}` });
    const withMutation = db.getCourses();
    assert.ok(withMutation.some((c) => (c.course_id || c.courseId) === mutated.courseId));

    const restored = db.restoreBackup({
      filePath: backup.filePath,
      confirmOverwrite: true,
    });

    assert.equal(restored.ok, true);
    assert.equal(typeof restored.tableCount, 'number');
    assert.equal(typeof restored.rowCounts.courses, 'number');

    const finalCourses = db.getCourses();
    assert.equal(finalCourses.length, baselineCourses.length);
    assert.equal(finalCourses.some((c) => (c.course_id || c.courseId) === mutated.courseId), false);
  });
});
