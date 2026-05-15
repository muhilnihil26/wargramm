import { useEffect } from "react";
import { ref, update } from "firebase/database";
import { supabase } from "@/integrations/supabase/client";
import { database } from "@/integrations/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { isUuid } from "@/lib/ids";
import { readLocalProfile } from "@/lib/localProfile";

const SYNC_EVERY_MS = 1000;
const SUPABASE_PRESENCE_EVERY_MS = 10_000;

function snapshotLocalState(userId: string) {
  const state: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (!key.startsWith("wargram-")) continue;
    if (key.includes(":") && !key.includes(userId)) {
      const globalKeys = ["wargram-theme", "wargram-ringtone", "wargram-chat-bg", "wargram-recent-searches"];
      if (!globalKeys.includes(key)) continue;
    }
    state[key] = localStorage.getItem(key) || "";
  }
  return state;
}

function makeSignature(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${hash}`;
}

export function useCloudAutoSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let lastSignature = "";
    let lastSupabasePresence = 0;

    const sync = async (reason: "tick" | "focus" | "change" = "tick") => {
      if (cancelled || document.hidden) return;
      const now = Date.now();
      const localProfile = readLocalProfile(user);
      const localState = snapshotLocalState(user.id);
      const payload = {
        user_id: user.id,
        email: user.email || null,
        display_name: localProfile?.full_name || user.displayName || null,
        username: localProfile?.username || user.email?.split("@")[0] || "user",
        avatar_url: localProfile?.avatar_url || user.photoURL || "",
        last_seen_ms: now,
        last_seen: new Date(now).toISOString(),
        online: true,
        path: window.location.pathname + window.location.search,
        reason,
        local_state: localState,
        local_state_updated_at: now,
      };
      const signature = makeSignature({ localState, path: payload.path, username: payload.username, avatar_url: payload.avatar_url });
      const shouldWriteFullState = signature !== lastSignature;
      lastSignature = signature;

      await Promise.all([
        update(ref(database, `liveSync/${user.id}`), shouldWriteFullState ? payload : {
          user_id: user.id,
          email: user.email || null,
          last_seen_ms: now,
          last_seen: payload.last_seen,
          online: true,
          path: payload.path,
          reason,
        }),
        update(ref(database, `profiles/${user.id}`), {
          firebase_uid: user.id,
          email: user.email || null,
          username: payload.username,
          full_name: payload.display_name || "",
          avatar_url: payload.avatar_url,
          last_seen_ms: now,
          last_seen: payload.last_seen,
          online: true,
          updated_at: now,
        }),
      ]);

      if (isUuid(user.id) && now - lastSupabasePresence > SUPABASE_PRESENCE_EVERY_MS) {
        lastSupabasePresence = now;
        await supabase
          .from("profiles")
          .update({ last_seen: payload.last_seen, updated_at: payload.last_seen } as any)
          .eq("user_id", user.id);
      }
    };

    sync("focus").catch(() => {});
    const interval = window.setInterval(() => sync("tick").catch(() => {}), SYNC_EVERY_MS);
    const onVisibility = () => sync("focus").catch(() => {});
    const onStorage = () => sync("change").catch(() => {});
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      update(ref(database, `liveSync/${user.id}`), {
        online: false,
        last_seen_ms: Date.now(),
        last_seen: new Date().toISOString(),
      }).catch(() => {});
    };
  }, [user]);
}
