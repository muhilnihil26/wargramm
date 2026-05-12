const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DESKTOP_URL = "https://wargram.netlify.app";
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

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("no-sandbox");
const userDataDir = path.join(path.dirname(process.execPath), "user-data");
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath("userData", userDataDir);

function createWindow() {
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
  win.loadURL(DESKTOP_URL).catch(() => {
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
