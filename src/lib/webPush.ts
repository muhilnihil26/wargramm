import { toast } from "sonner";

const ASKED_KEY = "wargram-web-push-asked";
const PREF_KEY = "wargram-web-push-enabled"; // "true" | "false"

export type WebPushStatus = "unsupported" | "granted" | "denied" | "default";

export function getWebPushStatus(): WebPushStatus {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as WebPushStatus;
}

export function getWebPushPreference(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(PREF_KEY);
  if (v === null) {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }
  return v === "true" && getWebPushStatus() === "granted";
}

export async function setWebPushPreference(enabled: boolean): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    toast.error("Notifications not supported on this device");
    return false;
  }
  if (enabled) {
    let perm = Notification.permission;
    if (perm === "default") {
      try { perm = await Notification.requestPermission(); } catch { perm = "denied"; }
    }
    if (perm !== "granted") {
      localStorage.setItem(PREF_KEY, "false");
      toast.error("Permission denied. Enable notifications in browser settings.");
      return false;
    }
    localStorage.setItem(PREF_KEY, "true");
    localStorage.setItem(ASKED_KEY, "1");
    try { new Notification("WarGram notifications enabled", { body: "We'll alert you here.", icon: "/favicon.ico" }); } catch {}
    toast.success("Notifications enabled");
    return true;
  } else {
    localStorage.setItem(PREF_KEY, "false");
    localStorage.setItem(ASKED_KEY, "1");
    toast.success("Notifications disabled");
    return false;
  }
}

export async function maybeRequestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (localStorage.getItem(PREF_KEY) === "false") return;
  // If already granted, just mark pref so toggle reflects it
  if (Notification.permission === "granted") {
    if (localStorage.getItem(PREF_KEY) === null) localStorage.setItem(PREF_KEY, "true");
    return;
  }
  if (Notification.permission !== "default") return;
  if (localStorage.getItem(ASKED_KEY)) return;
  // Note: many browsers (Chrome, Safari) ignore requestPermission outside a
  // user gesture. We still try once on first session — if blocked, the
  // Settings → Web notifications toggle will request it directly on tap.
  try {
    const perm = await Notification.requestPermission();
    localStorage.setItem(ASKED_KEY, "1");
    if (perm === "granted") {
      localStorage.setItem(PREF_KEY, "true");
      toast.success("Notifications enabled");
    } else {
      localStorage.setItem(PREF_KEY, "false");
    }
  } catch {
    // Browser refused outside user gesture — user can enable from Settings.
  }
}

export function notifyWeb(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (localStorage.getItem(PREF_KEY) === "false") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
}
