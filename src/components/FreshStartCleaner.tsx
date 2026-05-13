import { useEffect, useRef } from "react";
import { get, ref, remove, set } from "firebase/database";
import { toast } from "sonner";
import { database } from "@/integrations/firebase/config";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ID = "nxANfkUL63MSTv300eH6rSICw9w1";
const ADMIN_EMAIL = "muhilsiddhesh.in@gmail.com";
const RUN_KEY = "wargram-fresh-start-cleaned-v2";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const firebasePaths = [
  "firebasePosts",
  "firebaseReels",
  "firebaseStories",
  "postLikes",
  "reelLikes",
  "postComments",
  "reelComments",
  "profiles",
  "follows",
  "followers",
  "followRequests",
  "bookmarks",
  "youtubeLibrary",
  "callInvites",
  "pushTokens",
  "firebaseNotifications",
  "rooms",
  "messages",
  "calls",
];

const supabaseTables = [
  "message_reactions",
  "messages",
  "conversations",
  "comments",
  "reel_comments",
  "likes",
  "reel_likes",
  "saved_posts",
  "posts",
  "reels",
  "stories",
  "notifications",
  "follow_requests",
  "follows",
  "youtube_library",
  "youtube_library_client",
];

export function FreshStartCleaner() {
  const { user } = useAuth();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!user || runningRef.current) return;
    if (user.id !== ADMIN_ID && user.uid !== ADMIN_ID && user.email !== ADMIN_EMAIL) return;
    if (localStorage.getItem(RUN_KEY) === "done") return;
    runningRef.current = true;

    const run = async () => {
      toast.info("Fresh start cleanup running...");
      const adminSnap = await get(ref(database, `profiles/${ADMIN_ID}`)).catch(() => null);
      const adminProfile = adminSnap?.val?.() || {};

      await Promise.all(firebasePaths.map((path) => remove(ref(database, path)).catch(() => {})));
      await set(ref(database, `profiles/${ADMIN_ID}`), {
        ...adminProfile,
        user_id: ADMIN_ID,
        firebase_uid: ADMIN_ID,
        email: ADMIN_EMAIL,
        username: adminProfile.username || "muhilsiddhesh",
        full_name: adminProfile.full_name || "Muhil Siddhesh",
        is_admin: true,
        updated_at: Date.now(),
      }).catch(() => {});

      await Promise.all(
        supabaseTables.map((table) =>
          supabase.from(table as any).delete().neq("id", ZERO_UUID).catch(() => null),
        ),
      );
      await supabase.from("profiles").delete().neq("email", ADMIN_EMAIL).catch(() => null);

      Object.keys(localStorage)
        .filter((key) => key.startsWith("wargram-"))
        .forEach((key) => {
          if (["wargram-theme", "wargram-ringtone", "wargram-web-push-enabled", "wargram-web-push-asked"].includes(key)) return;
          localStorage.removeItem(key);
        });

      localStorage.setItem(RUN_KEY, "done");
      toast.success("Fresh app ready. All app data was cleared except admin.");
      setTimeout(() => window.location.reload(), 800);
    };

    run().finally(() => {
      runningRef.current = false;
    });
  }, [user]);

  return null;
}
