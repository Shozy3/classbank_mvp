const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const {
  initializeDatabase,
  closeDatabase,
  getCourses,
  getUnits,
  getTopics,
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  getQuestionReviewStats,
  listSessionHistory,
  getSessionHistoryDetail,
  getStatsDashboardSummary,
  saveSession,
  createCourse,
  updateCourse,
  deleteCourse,
  createUnit,
  updateUnit,
  deleteUnit,
  createTopic,
  updateTopic,
  deleteTopic,
  getFlashcards,
  getFlashcardById,
  createFlashcard,
  updateFlashcard,
  getItemCountsByTopic,
  searchItems,
  deleteQuestion,
  deleteFlashcard,
  duplicateQuestion,
  duplicateFlashcard,
  moveItems,
  updateItemFlags,
  listDueSpacedReviewItems,
  getSpacedReviewDueCounts,
  recordSpacedReviewRating,
  recordAdaptiveMcqResult,
  listAdaptiveWeakQuestions,
  createBackup,
  restoreBackup,
} = require('./db');

let mainWindow;

function withDbHandler(label, fn) {
  return async (_event, payload) => {
    try {
      return fn(payload);
    } catch (error) {
      console.error(`[db] ${label} failed:`, error);
      throw error;
    }
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0f1117',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const entryPath = path.join(__dirname, 'practice-setup', 'index.html');
  mainWindow.loadFile(entryPath);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Keep app navigation inside the same window for local file routes.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://')) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  initializeDatabase({
    userDataPath: app.getPath('userData'),
    schemaPath: path.join(__dirname, 'schema.sql'),
    fixturePath: path.join(__dirname, 'fixtures', 'sample-course-data.json'),
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('db:getCourses', withDbHandler('getCourses', () => getCourses()));

ipcMain.handle('db:getUnits', withDbHandler('getUnits', (courseId) => getUnits(courseId)));

ipcMain.handle('db:createCourse',         withDbHandler('createCourse',         (p) => createCourse(p)));
ipcMain.handle('db:updateCourse',         withDbHandler('updateCourse',         (p) => updateCourse(p)));
ipcMain.handle('db:deleteCourse',         withDbHandler('deleteCourse',         (id) => deleteCourse(id)));
ipcMain.handle('db:createUnit',           withDbHandler('createUnit',           (p) => createUnit(p)));
ipcMain.handle('db:updateUnit',           withDbHandler('updateUnit',           (p) => updateUnit(p)));
ipcMain.handle('db:deleteUnit',           withDbHandler('deleteUnit',           (id) => deleteUnit(id)));
ipcMain.handle('db:createTopic',          withDbHandler('createTopic',          (p) => createTopic(p)));
ipcMain.handle('db:updateTopic',          withDbHandler('updateTopic',          (p) => updateTopic(p)));
ipcMain.handle('db:deleteTopic',          withDbHandler('deleteTopic',          (id) => deleteTopic(id)));
ipcMain.handle('db:getFlashcards',        withDbHandler('getFlashcards',        (topicId) => getFlashcards(topicId)));
ipcMain.handle('db:getItemCountsByTopic', withDbHandler('getItemCountsByTopic', (ids) => getItemCountsByTopic(ids)));
ipcMain.handle('db:searchItems',          withDbHandler('searchItems',          (p) => searchItems(p)));
ipcMain.handle('db:deleteQuestion',       withDbHandler('deleteQuestion',       (id) => deleteQuestion(id)));
ipcMain.handle('db:deleteFlashcard',      withDbHandler('deleteFlashcard',      (id) => deleteFlashcard(id)));
ipcMain.handle('db:duplicateQuestion',    withDbHandler('duplicateQuestion',    (id) => duplicateQuestion(id)));
ipcMain.handle('db:duplicateFlashcard',   withDbHandler('duplicateFlashcard',   (id) => duplicateFlashcard(id)));
ipcMain.handle('db:moveItems',            withDbHandler('moveItems',            (p) => moveItems(p)));
ipcMain.handle('db:updateItemFlags',      withDbHandler('updateItemFlags',      (p) => updateItemFlags(p)));
ipcMain.handle('db:listDueSpacedReviewItems', withDbHandler('listDueSpacedReviewItems', (p) => listDueSpacedReviewItems(p)));
ipcMain.handle('db:getSpacedReviewDueCounts', withDbHandler('getSpacedReviewDueCounts', (p) => getSpacedReviewDueCounts(p)));
ipcMain.handle('db:recordSpacedReviewRating', withDbHandler('recordSpacedReviewRating', (p) => recordSpacedReviewRating(p)));
ipcMain.handle('db:recordAdaptiveMcqResult', withDbHandler('recordAdaptiveMcqResult', (p) => recordAdaptiveMcqResult(p)));
ipcMain.handle('db:listAdaptiveWeakQuestions', withDbHandler('listAdaptiveWeakQuestions', (p) => listAdaptiveWeakQuestions(p)));
ipcMain.handle('db:createBackup', withDbHandler('createBackup', (p) => createBackup(p)));
ipcMain.handle('db:restoreBackup', withDbHandler('restoreBackup', (p) => restoreBackup(p)));

ipcMain.handle('db:getTopics', withDbHandler('getTopics', (unitId) => getTopics(unitId)));

ipcMain.handle('db:getQuestions', withDbHandler('getQuestions', (filters) => getQuestions(filters)));
ipcMain.handle('db:getQuestionById', withDbHandler('getQuestionById', (questionId) => getQuestionById(questionId)));
ipcMain.handle('db:createQuestion', withDbHandler('createQuestion', (payload) => createQuestion(payload)));
ipcMain.handle('db:updateQuestion', withDbHandler('updateQuestion', (payload) => updateQuestion(payload)));

ipcMain.handle('db:getQuestionReviewStats', withDbHandler('getQuestionReviewStats', (questionId) => getQuestionReviewStats(questionId)));
ipcMain.handle('db:listSessionHistory', withDbHandler('listSessionHistory', (options) => listSessionHistory(options)));
ipcMain.handle('db:getSessionHistoryDetail', withDbHandler('getSessionHistoryDetail', (payload) => getSessionHistoryDetail(payload)));
ipcMain.handle('db:getStatsDashboardSummary', withDbHandler('getStatsDashboardSummary', () => getStatsDashboardSummary()));
ipcMain.handle('db:getFlashcardById', withDbHandler('getFlashcardById', (flashcardId) => getFlashcardById(flashcardId)));
ipcMain.handle('db:createFlashcard', withDbHandler('createFlashcard', (payload) => createFlashcard(payload)));
ipcMain.handle('db:updateFlashcard', withDbHandler('updateFlashcard', (payload) => updateFlashcard(payload)));

ipcMain.handle('db:saveSession', withDbHandler('saveSession', (payload) => saveSession(payload)));
