import type { User } from "firebase/auth";
import { supabase } from "@/integrations/supabase/client";
import { defaultLocalProfile, readLocalProfile, updateLocalProfile, type LocalProfile } from "./localProfile";

export async function readClientProfile(user: (User & { id: string }) | null): Promise<LocalProfile | null> {
  if (!user) return null;
  const fallback = readLocalProfile(user) || defaultLocalProfile(user);
  try {
    const { data, error } = await supabase
      .from("firebase_profiles" as any)
      .select("*")
      .eq("firebase_uid", user.id)
      .maybeSingle();
    if (error || !data) return fallback;
    return {
      ...fallback,
      user_id: user.id,
      username: data.username || fallback.username,
      full_name: data.full_name || fallback.full_name,
      avatar_url: data.avatar_url || fallback.avatar_url,
      bio: data.bio || "",
      website: data.website || "",
      instagram_username: data.instagram_username || null,
      phone: data.phone || null,
      is_private: !!data.is_private,
      show_activity: data.show_activity !== false,
      notification_ringtone: data.notification_ringtone || fallback.notification_ringtone,
      account_type: data.account_type || fallback.account_type,
      is_verified: !!data.is_verified,
      verification_status: data.verification_status || null,
      onboarded_at: data.onboarded_at || fallback.onboarded_at,
    };
  } catch {
    return fallback;
  }
}

export async function saveClientProfile(user: User & { id: string }, patch: Partial<LocalProfile>) {
  const local = updateLocalProfile(user, patch) || { ...defaultLocalProfile(user), ...patch };
  const payload = {
    firebase_uid: user.id,
    email: user.email || null,
    username: local.username,
    full_name: local.full_name,
    avatar_url: local.avatar_url,
    bio: local.bio || "",
    website: local.website || "",
    instagram_username: local.instagram_username || null,
    phone: local.phone || null,
    is_private: !!local.is_private,
    show_activity: local.show_activity !== false,
    notification_ringtone: local.notification_ringtone || null,
    account_type: local.account_type || "personal",
  };
  const { error } = await supabase
    .from("firebase_profiles" as any)
    .upsert(payload, { onConflict: "firebase_uid" });
  return { profile: local, error };
}
