const { app, BrowserWindow, shell, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const AUTH_POPUP_HOSTS = [
  "accounts.google.com",
  "wargram-c2a79.firebaseapp.com",
  "firebaseapp.com",
  "google.com",
  "gstatic.com",
];
let localServer;
let mainWindow;
let appOrigin = "https://wargram.app";

function logDesktopError(message) {
  try {
    const logPath = path.join(app.getPath("userData"), "desktop-error.log");
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never stop the app from opening.
  }
}

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
  const distDir = path.resolve(__dirname, "dist");
  localServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
    let filePath = path.resolve(distDir, safePath);

    if (!filePath.startsWith(`${distDir}${path.sep}`) && filePath !== distDir) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }
    } catch (error) {
      logDesktopError(`Static file lookup failed: ${error.message}`);
      filePath = path.join(distDir, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        logDesktopError(`Static file read failed: ${filePath} ${err.message}`);
        res.writeHead(500);
        res.end("<!doctype html><title>Wargram</title><body style=\"background:#0b0b0f;color:#fff;font-family:sans-serif;padding:24px\">Wargram could not load its local files.</body>");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    localServer.listen(0, "127.0.0.1", () => {
      const address = localServer.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
    localServer.on("error", (error) => {
      logDesktopError(`Local server failed: ${error.message}`);
      resolve("https://wargram.netlify.app");
    });
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
    width: 1280,
    height: 800,
    minWidth: 960,
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
  mainWindow = win;
  win.once("ready-to-show", () => {
    win.show();
  });
  win.on("close", () => {
    logDesktopError("Main window close requested");
  });
  win.on("closed", () => {
    logDesktopError("Main window closed");
    mainWindow = null;
  });

  win.removeMenu();
  const appUrl = await startLocalAppServer();
  try {
    appOrigin = new URL(appUrl).origin;
    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: [
          "*://www.youtube.com/embed/*",
          "*://www.youtube-nocookie.com/embed/*",
          "*://www.youtube.com/iframe_api*",
          "*://www.youtube.com/s/player/*",
        ],
      },
      (details, callback) => {
        const requestHeaders = { ...details.requestHeaders };
        requestHeaders.Referer = `${appOrigin}/`;
        requestHeaders.Origin = appOrigin;
        callback({ requestHeaders });
      },
    );
  } catch (error) {
    logDesktopError(`YouTube referrer setup failed: ${error.message}`);
  }
  win.loadURL(appUrl).catch(() => {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logDesktopError(`Load failed ${errorCode} ${errorDescription} ${validatedURL}`);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    logDesktopError(`Renderer exited: ${details.reason}`);
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) logDesktopError(`Console ${level}: ${message} (${sourceId}:${line})`);
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

app.on("before-quit", () => {
  logDesktopError("App before-quit");
});

app.on("window-all-closed", () => {
  logDesktopError("All windows closed");
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
