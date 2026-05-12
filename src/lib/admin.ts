import type { User } from "firebase/auth";

export const ADMIN_EMAILS = new Set(["muhilsiddhesh.in@gmail.com"]);
export const ADMIN_FIREBASE_UIDS = new Set(["nxANfkUL63MSTv300eH6rSICw9w1"]);

export function isConfiguredAdmin(user?: User | null) {
  if (!user) return false;
  return ADMIN_FIREBASE_UIDS.has(user.uid) || (!!user.email && ADMIN_EMAILS.has(user.email.toLowerCase()));
}
