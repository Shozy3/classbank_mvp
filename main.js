const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');

let mainWindow;

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

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('db:getCourses', async () => {
  return [];
});

ipcMain.handle('db:getUnits', async (_event, _courseId) => {
  return [];
});

ipcMain.handle('db:getTopics', async (_event, _unitId) => {
  return [];
});

ipcMain.handle('db:getQuestions', async (_event, _filters) => {
  return [];
});

ipcMain.handle('db:saveSession', async (_event, _payload) => {
  return { ok: true, message: 'Stub only: implemented in Issue #3.' };
});
