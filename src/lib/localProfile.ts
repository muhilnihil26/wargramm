import type { User } from "firebase/auth";
import { isUuid } from "./ids";
import { getKnownProfile } from "./knownUsers";

export type LocalProfile = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio?: string;
  website?: string;
  instagram_username?: string | null;
  phone?: string | null;
  is_private?: boolean;
  show_activity?: boolean;
  notification_ringtone?: string | null;
  account_type?: "personal" | "business" | "developer";
  is_verified?: boolean;
  verification_status?: string | null;
  onboarded_at?: string | null;
};

export function localProfileKey(userId: string) {
  return `wargram-local-profile:${userId}`;
}

export function defaultLocalProfile(user: User & { id: string }): LocalProfile {
  const known = getKnownProfile(user.email);
  return {
    user_id: user.id,
    username: known?.username || user.displayName || user.email?.split("@")[0] || "user",
    full_name: known?.fullName || user.displayName || "",
    avatar_url: user.photoURL || "",
    bio: "",
    website: "",
    instagram_username: null,
    phone: null,
    is_private: false,
    show_activity: true,
    notification_ringtone: localStorage.getItem("wargram-ringtone") || "wargram",
    account_type: "personal",
    is_verified: false,
    verification_status: null,
    onboarded_at: null,
  };
}

export function readLocalProfile(user: (User & { id: string }) | null): LocalProfile | null {
  if (!user || isUuid(user.id)) return null;
  try {
    return { ...defaultLocalProfile(user), ...JSON.parse(localStorage.getItem(localProfileKey(user.id)) || "{}") };
  } catch {
    return defaultLocalProfile(user);
  }
}

export function updateLocalProfile(user: User & { id: string }, patch: Partial<LocalProfile>) {
  if (isUuid(user.id)) return;
  const next = { ...defaultLocalProfile(user), ...(readLocalProfile(user) || {}), ...patch };
  localStorage.setItem(localProfileKey(user.id), JSON.stringify(next));
  if (next.notification_ringtone) localStorage.setItem("wargram-ringtone", next.notification_ringtone);
  return next;
}
