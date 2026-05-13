import { get, ref, remove, set } from "firebase/database";
import { database } from "@/integrations/firebase/config";

export async function saveFirebasePostBookmark(userId: string, postId: string, saved: boolean) {
  const path = `bookmarks/${userId}/posts/${postId}`;
  if (saved) {
    await set(ref(database, path), { post_id: postId, saved_at: Date.now() });
  } else {
    await remove(ref(database, path));
  }
}

export async function readFirebasePostBookmarks(userId: string): Promise<string[]> {
  const snapshot = await get(ref(database, `bookmarks/${userId}/posts`));
  const value = snapshot.val();
  if (!value) return [];
  return Object.keys(value);
}

export async function readFirebasePublicProfile(uid: string) {
  const snapshot = await get(ref(database, `profiles/${uid}`));
  return snapshot.val();
}

export async function searchFirebaseProfiles(term: string, currentUserId?: string | null, limit = 15) {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < 2) return [];
  const snapshot = await get(ref(database, "profiles"));
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([uid, profile]: [string, any]) => ({
      user_id: uid,
      username: profile.username || profile.email?.split("@")[0] || "user",
      full_name: profile.full_name || "",
      avatar_url: profile.avatar_url || "",
      email: profile.email || "",
      is_verified: !!profile.is_verified,
    }))
    .filter((row) => row.user_id !== currentUserId)
    .filter((row) => `${row.username} ${row.full_name} ${row.email}`.toLowerCase().includes(normalized))
    .slice(0, limit);
}
