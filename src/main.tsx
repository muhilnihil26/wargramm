import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Firebase
import "./integrations/firebase/config";

// Initialize services
import { notificationService } from "./services/notificationService";

async function initializeApp() {
  await notificationService.initialize();
}

initializeApp();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
