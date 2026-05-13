import type { User } from "firebase/auth";
import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "./ids";
import { mediaOwnerId } from "./firebaseMedia";
import { readFirebaseFollowingIds } from "./firebaseUserData";

type AppUser = (User & { id: string }) | null | undefined;

async function getViewerFollowingIds(user: AppUser): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!user?.id) return ids;

  if (isUuid(user.id)) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    (data || []).forEach((row: any) => row.following_id && ids.add(row.following_id));
  }

  const firebaseIds = await readFirebaseFollowingIds(user.id).catch(() => []);
  firebaseIds.forEach((id) => ids.add(id));
  return ids;
}

export async function filterVisibleMediaRows<T extends Record<string, any>>(rows: T[], user: AppUser): Promise<T[]> {
  const followingIds = await getViewerFollowingIds(user);
  return rows.filter((row: any) => {
    if (row?.is_removed) return false;
    const ownerId = mediaOwnerId(row);
    const visibility = row?.visibility || "public";
    if (visibility === "public") return true;
    if (!user?.id) return false;
    if (ownerId && ownerId === user.id) return true;
    if (visibility === "followers") return !!ownerId && followingIds.has(ownerId);
    return false;
  });
}

export async function canViewPrivateOwner(user: AppUser, ownerId?: string | null) {
  if (!ownerId) return false;
  if (user?.id === ownerId) return true;
  const followingIds = await getViewerFollowingIds(user);
  return followingIds.has(ownerId);
}
