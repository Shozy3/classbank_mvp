const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const {
  initializeDatabase,
  closeDatabase,
  getCourses,
  getUnits,
  getTopics,
  getQuestions,
  getQuestionReviewStats,
  saveSession,
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

ipcMain.handle('db:getTopics', withDbHandler('getTopics', (unitId) => getTopics(unitId)));

ipcMain.handle('db:getQuestions', withDbHandler('getQuestions', (filters) => getQuestions(filters)));

ipcMain.handle('db:getQuestionReviewStats', withDbHandler('getQuestionReviewStats', (questionId) => getQuestionReviewStats(questionId)));

ipcMain.handle('db:saveSession', withDbHandler('saveSession', (payload) => saveSession(payload)));
