import { supabase } from "@/integrations/supabase/client";
import { listVisibleKnownProfiles } from "./knownUsers";
import { searchFirebaseProfiles } from "./firebaseUserData";
import { isDeletedUserRow } from "./deletedUsers";

type UserRow = {
  user_id: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  email?: string | null;
  is_known_only?: boolean;
};

export async function searchUsersEverywhere(query: string, currentUserId?: string | null, limit = 15): Promise<UserRow[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const normalized = term.toLowerCase();
  const byId = new Map<string, UserRow>();

  const add = (row: UserRow | null | undefined) => {
    if (!row?.user_id || row.user_id === currentUserId || byId.has(row.user_id)) return;
    if (isDeletedUserRow(row)) return;
    const haystack = `${row.username || ""} ${row.full_name || ""} ${row.email || ""}`.toLowerCase();
    if (!haystack.includes(normalized)) return;
    byId.set(row.user_id, row);
  };

  const profileQuery = supabase
    .from("profiles")
    .select("user_id, username, full_name, avatar_url, is_verified, email")
    .or(`username.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(limit);
  const { data: profiles, error } = await profileQuery;
  if (!error) (profiles || []).forEach((p: any) => add(p));

  const clientProfiles = await searchFirebaseProfiles(term, currentUserId, limit).catch(() => []);
  clientProfiles.forEach((p: any) => add(p));

  const mediaColumns = "firebase_uid, firebase_email, firebase_display_name, firebase_photo_url";
  const mediaResults = await Promise.all([
    supabase.from("posts").select(mediaColumns).not("firebase_uid", "is", null).limit(100),
    supabase.from("reels").select(mediaColumns).not("firebase_uid", "is", null).limit(100),
    supabase.from("stories").select(mediaColumns).not("firebase_uid", "is", null).limit(100),
  ]);
  mediaResults.forEach(({ data }) => {
    (data || []).forEach((row: any) => add({
      user_id: row.firebase_uid,
      username: row.firebase_display_name || row.firebase_email?.split("@")[0] || "user",
      full_name: row.firebase_email || "",
      email: row.firebase_email || null,
      avatar_url: row.firebase_photo_url || "",
      is_verified: false,
    }));
  });

  listVisibleKnownProfiles().forEach((p) => add(p));
  return [...byId.values()].slice(0, limit);
}
