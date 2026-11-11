// Envoltorio de escritorio (Electron): abre el juego compilado (dist/) en una ventana propia.
// Los archivos se sirven con un protocolo propio (app://) para que fetch() y los módulos funcionen como en la web.
const { app, BrowserWindow, protocol, net, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: "#0d0e0f", autoHideMenuBar: true, title: "Proving Grounds",
    webPreferences: { contextIsolation: true, backgroundThrottling: false },
  });
  win.loadURL("app://game/index.html");
  win.webContents.on("before-input-event", (_e, input) => { if (input.type === "keyDown" && input.key === "F11") win.setFullScreen(!win.isFullScreen()); });
}

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
