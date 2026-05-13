import { get, push, ref, remove, set } from "firebase/database";
import { database } from "@/integrations/firebase/config";
import type { User } from "firebase/auth";
import { mediaOwnerPayload } from "./firebaseMedia";

type MediaKind = "post" | "reel" | "story";

const mediaPath = (kind: MediaKind) => (kind === "post" ? "firebasePosts" : kind === "reel" ? "firebaseReels" : "firebaseStories");

export async function saveFirebaseMedia(kind: MediaKind, user: User, payload: Record<string, any>) {
  const itemRef = push(ref(database, mediaPath(kind)));
  const now = new Date().toISOString();
  const row = {
    ...mediaOwnerPayload(user),
    ...payload,
    id: itemRef.key,
    user_id: payload.user_id || null,
    firebase_uid: user.uid || user.id,
    created_at: payload.created_at || now,
    firebase_backup: true,
  };
  await set(itemRef, row);
  return row;
}

export async function readFirebaseMedia(kind: MediaKind) {
  const snapshot = await get(ref(database, mediaPath(kind)));
  const value = snapshot.val();
  if (!value) return [];
  return Object.values(value)
    .filter(Boolean)
    .sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0)) as any[];
}

export async function saveFirebaseYouTubeItem(user: User, payload: Record<string, any>) {
  const itemRef = push(ref(database, `youtubeLibrary/${user.uid || user.id}`));
  const row = {
    ...payload,
    id: itemRef.key,
    firebase_uid: user.uid || user.id,
    created_at: payload.created_at || new Date().toISOString(),
    firebase_backup: true,
  };
  await set(itemRef, row);
  return row;
}

export async function readFirebaseYouTubeItems(userId: string) {
  const snapshot = await get(ref(database, `youtubeLibrary/${userId}`));
  const value = snapshot.val();
  if (!value) return [];
  return Object.values(value)
    .filter(Boolean)
    .sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0)) as any[];
}

export async function deleteFirebaseYouTubeItem(userId: string, itemId: string) {
  await remove(ref(database, `youtubeLibrary/${userId}/${itemId}`));
}

export async function sendFirebaseNotification(userId: string, payload: Record<string, any>) {
  if (!userId) return null;
  const itemRef = push(ref(database, `firebaseNotifications/${userId}`));
  const row = {
    ...payload,
    id: itemRef.key,
    read: false,
    created_at: new Date().toISOString(),
    created_at_ms: Date.now(),
  };
  await set(itemRef, row);
  return row;
}

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

export async function saveFirebaseLike(kind: "post" | "reel", itemId: string, userId: string, liked: boolean) {
  const path = `${kind}Likes/${itemId}/${userId}`;
  if (liked) await set(ref(database, path), { user_id: userId, liked_at: Date.now() });
  else await remove(ref(database, path));
}

export async function saveFirebaseReelBookmark(userId: string, reelId: string, saved: boolean) {
  const path = `bookmarks/${userId}/reels/${reelId}`;
  if (saved) await set(ref(database, path), { reel_id: reelId, saved_at: Date.now() });
  else await remove(ref(database, path));
}

export async function saveFirebaseComment(kind: "post" | "reel", itemId: string, comment: Record<string, any>) {
  const itemRef = push(ref(database, `${kind}Comments/${itemId}`));
  await set(itemRef, { ...comment, id: itemRef.key, created_at_ms: Date.now() });
  return { ...comment, id: itemRef.key };
}

export async function readFirebaseComments(kind: "post" | "reel", itemId: string) {
  const snapshot = await get(ref(database, `${kind}Comments/${itemId}`));
  const value = snapshot.val();
  if (!value) return [];
  return Object.values(value) as any[];
}

export async function readFirebasePublicProfile(uid: string) {
  const snapshot = await get(ref(database, `profiles/${uid}`));
  const value = snapshot.val();
  return value;
}

export type FirebaseFollowState = "none" | "following" | "requested";

export async function saveFirebaseFollowState(userId: string, targetUserId: string, state: FirebaseFollowState) {
  const followingPath = `follows/${userId}/following/${targetUserId}`;
  const followerPath = `followers/${targetUserId}/${userId}`;
  const requestPath = `followRequests/${targetUserId}/${userId}`;

  if (state === "none") {
    await Promise.all([
      remove(ref(database, followingPath)),
      remove(ref(database, followerPath)),
      remove(ref(database, requestPath)),
    ]);
    return;
  }

  if (state === "requested") {
    await Promise.all([
      remove(ref(database, followingPath)),
      remove(ref(database, followerPath)),
      set(ref(database, requestPath), { requester_id: userId, target_id: targetUserId, created_at: Date.now(), status: "pending" }),
    ]);
    return;
  }

  await Promise.all([
    remove(ref(database, requestPath)),
    set(ref(database, followingPath), { following_id: targetUserId, created_at: Date.now() }),
    set(ref(database, followerPath), { follower_id: userId, created_at: Date.now() }),
  ]);
}

export async function readFirebaseFollowState(userId: string, targetUserId: string): Promise<FirebaseFollowState> {
  const [following, request] = await Promise.all([
    get(ref(database, `follows/${userId}/following/${targetUserId}`)),
    get(ref(database, `followRequests/${targetUserId}/${userId}`)),
  ]);
  if (following.exists()) return "following";
  if (request.exists()) return "requested";
  return "none";
}

export async function readFirebaseFollowingIds(userId: string): Promise<string[]> {
  const snapshot = await get(ref(database, `follows/${userId}/following`));
  const value = snapshot.val();
  if (!value) return [];
  return Object.keys(value);
}

export async function readFirebaseFollowCounts(userId: string) {
  const [followersSnap, followingSnap] = await Promise.all([
    get(ref(database, `followers/${userId}`)),
    get(ref(database, `follows/${userId}/following`)),
  ]);
  return {
    followers: followersSnap.val() ? Object.keys(followersSnap.val()).length : 0,
    following: followingSnap.val() ? Object.keys(followingSnap.val()).length : 0,
  };
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

export async function listFirebaseProfiles(currentUserId?: string | null, limit = 20) {
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
      updated_at: profile.updated_at || 0,
    }))
    .filter((row) => row.user_id !== currentUserId)
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    .slice(0, limit);
}
