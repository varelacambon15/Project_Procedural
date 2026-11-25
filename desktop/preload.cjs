// Puente seguro entre el juego y el disco (partidas guardadas). Solo expone estas cuatro operaciones.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ppStorage", {
  read: (key) => ipcRenderer.invoke("save:read", key),
  write: (key, data) => ipcRenderer.invoke("save:write", key, data),
  list: () => ipcRenderer.invoke("save:list"),
  remove: (key) => ipcRenderer.invoke("save:remove", key),
});
// Registro de sesión (modo desarrollador): escribe capturas y registros en Documentos/ProvingGrounds/sesiones.
contextBridge.exposeInMainWorld("ppSession", { write: (rel, b64) => ipcRenderer.invoke("session:write", rel, b64) });
contextBridge.exposeInMainWorld("ppApp", { quit: () => ipcRenderer.invoke("app:quit") });
