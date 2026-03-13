const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getCourses: () => ipcRenderer.invoke('db:getCourses'),
  getUnits: (courseId) => ipcRenderer.invoke('db:getUnits', courseId),
  getTopics: (unitId) => ipcRenderer.invoke('db:getTopics', unitId),
  getQuestions: (filters) => ipcRenderer.invoke('db:getQuestions', filters),
  saveSession: (payload) => ipcRenderer.invoke('db:saveSession', payload),
  getVersion: () => ipcRenderer.invoke('app:getVersion')
});
