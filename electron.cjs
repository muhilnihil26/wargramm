const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const DESKTOP_PORT = 41737;
const AUTH_POPUP_HOSTS = [
  "accounts.google.com",
  "wargram-c2a79.firebaseapp.com",
  "firebaseapp.com",
  "google.com",
  "gstatic.com",
];

function isAuthPopup(url) {
  try {
    const { hostname } = new URL(url);
    return AUTH_POPUP_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

function startLocalAppServer() {
  const distDir = path.join(__dirname, "dist");
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://localhost:${DESKTOP_PORT}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = decodedPath === "/" ? "/index.html" : decodedPath;
    let filePath = path.join(distDir, safePath);

    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Could not load Wargram");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(DESKTOP_PORT, "localhost", () => resolve(`http://localhost:${DESKTOP_PORT}`));
    server.on("error", () => resolve("https://wargram.netlify.app"));
  });
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("no-sandbox");
const userDataDir = path.join(path.dirname(process.execPath), "user-data");
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath("userData", userDataDir);

async function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 820,
    minWidth: 360,
    minHeight: 640,
    title: "Wargram",
    icon: path.join(__dirname, "public", "favicon.ico"),
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.removeMenu();
  const appUrl = await startLocalAppServer();
  win.loadURL(appUrl).catch(() => {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopup(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 430,
          height: 720,
          title: "Wargram sign in",
          icon: path.join(__dirname, "public", "favicon.ico"),
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
