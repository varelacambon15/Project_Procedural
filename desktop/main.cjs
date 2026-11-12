// Envoltorio de escritorio (Electron): abre el juego compilado (dist/) en una ventana propia.
// Los archivos se sirven con un protocolo propio (app://) para que fetch() y los módulos funcionen como en la web.
const { app, BrowserWindow, protocol, net, Menu, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: "#0d0e0f", autoHideMenuBar: true, title: "Proving Grounds",
    webPreferences: { contextIsolation: true, backgroundThrottling: false, preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadURL("app://game/index.html");
  win.webContents.on("before-input-event", (_e, input) => { if (input.type === "keyDown" && input.key === "F11") win.setFullScreen(!win.isFullScreen()); });
}

// ---------- Partidas guardadas: un archivo .json por clave en la carpeta de datos del usuario ----------
// Escritura segura ante cortes: se escribe a .tmp, se fuerza al disco y se renombra encima (operación atómica).
const savesDir = () => path.join(app.getPath("userData"), "saves");
const safeKey = (k) => { if (typeof k !== "string" || !/^[a-z0-9._-]{1,64}$/i.test(k)) throw new Error("bad key"); return k; };
const fileOf = (k) => path.join(savesDir(), `${safeKey(k)}.json`);
const isJson = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
ipcMain.handle("save:read", async (_e, key) => {
  const f = fileOf(key);
  const main = await fs.readFile(f, "utf8").catch(() => null);
  if (main !== null && isJson(main)) return main;
  const tmp = await fs.readFile(f + ".tmp", "utf8").catch(() => null);
  if (tmp !== null && isJson(tmp)) { await fs.rename(f + ".tmp", f).catch(() => undefined); return tmp; }
  return main;
});
ipcMain.handle("save:write", async (_e, key, data) => {
  if (typeof data !== "string" || data.length > 20e6) throw new Error("bad data");
  await fs.mkdir(savesDir(), { recursive: true });
  const f = fileOf(key), h = await fs.open(f + ".tmp", "w");
  try { await h.writeFile(data, "utf8"); await h.sync(); } finally { await h.close(); }
  await fs.rename(f + ".tmp", f);
});
ipcMain.handle("save:list", async () => (await fs.readdir(savesDir()).catch(() => [])).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)));
ipcMain.handle("save:remove", async (_e, key) => { await fs.rm(fileOf(key), { force: true }); await fs.rm(fileOf(key) + ".tmp", { force: true }); });
ipcMain.handle("app:quit", () => app.quit());

app.whenReady().then(() => {
  const root = path.join(__dirname, "..", "dist");
  protocol.handle("app", (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "");
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  createWindow();
});
app.on("window-all-closed", () => app.quit());
