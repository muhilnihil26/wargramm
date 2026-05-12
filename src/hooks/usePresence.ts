import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isUuid } from "@/lib/ids";

/**
 * Heartbeat: updates the current user's `last_seen` timestamp every 30s
 * while the tab is visible. Combine with `isOnline(last_seen)` to render dots.
 */
export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isUuid(user.id)) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled || document.hidden) return;
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() } as any)
        .eq("user_id", user.id);
    };

    beat();
    const interval = setInterval(beat, 30000);
    const onVisibility = () => { if (!document.hidden) beat(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);
}

/** Returns true if last_seen is within 90 seconds. */
export function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 90_000;
}
