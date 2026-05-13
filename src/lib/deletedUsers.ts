export const DELETED_USER_EMAILS = new Set([
  "infantjeril442@gmail.com",
  "nihilyadesh2015@gmail.com",
  "sanjanashreer682@gmail.com",
  "mithresh0205@gmail.com",
  "yazhinimanikumar@gmail.com",
  "mmugeshdharan@gmail.com",
  "5b.vrrithikamfts@gmail.com",
  "ananya2505123456@gmail.com",
  "dharunashok011@gmail.com",
  "tamilselvanask7@gmail.com",
]);

export function isDeletedUserEmail(email?: string | null) {
  return !!email && DELETED_USER_EMAILS.has(email.toLowerCase());
}

export function isDeletedUserRow(row: Record<string, any> | null | undefined) {
  if (!row) return false;
  return isDeletedUserEmail(row.email || row.firebase_email || row.full_name);
}
