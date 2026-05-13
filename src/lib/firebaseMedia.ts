import type { User } from "firebase/auth";
import { isUuid } from "./ids";
import { readLocalProfile } from "./localProfile";

export function mediaOwnerPayload(user: (User & { id: string }) | null) {
  if (!user) return {};
  if (isUuid(user.id)) return { user_id: user.id };
  const localProfile = readLocalProfile(user);
  return {
    user_id: null,
    firebase_uid: user.id,
    firebase_email: user.email || null,
    firebase_display_name: localProfile?.username || user.displayName || user.email?.split("@")[0] || "user",
    firebase_photo_url: localProfile?.avatar_url || user.photoURL || null,
  };
}

export function mediaOwnerId(row: any) {
  return row?.firebase_uid || row?.user_id || "";
}

export function mediaOwnerName(row: any, profile?: any) {
  return profile?.username || row?.firebase_display_name || row?.firebase_email?.split("@")[0] || "user";
}

export function mediaOwnerAvatar(row: any, profile?: any) {
  return profile?.avatar_url || row?.firebase_photo_url || "";
}
