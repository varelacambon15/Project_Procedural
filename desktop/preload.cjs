// Puente seguro entre el juego y el disco (partidas guardadas). Solo expone estas cuatro operaciones.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ppStorage", {
  read: (key) => ipcRenderer.invoke("save:read", key),
  write: (key, data) => ipcRenderer.invoke("save:write", key, data),
  list: () => ipcRenderer.invoke("save:list"),
  remove: (key) => ipcRenderer.invoke("save:remove", key),
});
contextBridge.exposeInMainWorld("ppApp", { quit: () => ipcRenderer.invoke("app:quit") });
