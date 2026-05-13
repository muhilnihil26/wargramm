import type { User } from "firebase/auth";
import { push, ref, set } from "firebase/database";
import { database } from "@/integrations/firebase/config";

type AppUser = (User & { id: string }) | null | undefined;

export async function logCloudAction(user: AppUser, action: string, metadata: Record<string, any> = {}) {
  if (!user?.id || !action) return;
  const payload = {
    action,
    user_id: user.id,
    email: user.email || null,
    display_name: user.displayName || null,
    metadata,
    created_at: Date.now(),
  };
  const userActionRef = push(ref(database, `userActions/${user.id}`));
  await Promise.all([
    set(userActionRef, payload),
    set(ref(database, `lastActions/${user.id}/${action}`), payload),
  ]);
}
