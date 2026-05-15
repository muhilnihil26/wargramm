const LEGACY_EMAILS = new Set([
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

const ADMIN_EMAIL = "muhilsiddhesh.in@gmail.com";
const ADMIN_FIREBASE_UID = "nxANfkUL63MSTv300eH6rSICw9w1";
const FRESH_START_AT_MS = new Date("2026-05-14T00:00:00+05:30").getTime();

const LEGACY_NAME_PARTS = [
  "infantjeril",
  "nihilyadesh",
  "sanjanashreer",
  "mithresh",
  "yazhinimanikumar",
  "mmugeshdharan",
  "vrrithika",
  "ananya2505123456",
  "dharunashok",
  "tamilselvanask7",
];

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function readTime(value: unknown) {
  if (!value) return 0;
  if (typeof value === "number") return value > 100000000000 ? value : value * 1000;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowTime(row: any) {
  return Math.max(
    readTime(row?.created_at),
    readTime(row?.updated_at),
    readTime(row?.onboarded_at),
    readTime(row?.created_at_ms),
    readTime(row?.updated_at_ms),
  );
}

export function isAdminProfile(row: any) {
  if (!row) return false;
  return [
    row.id,
    row.user_id,
    row.uid,
    row.firebase_uid,
  ].some((value) => value === ADMIN_FIREBASE_UID) || normalize(row.email || row.firebase_email) === ADMIN_EMAIL;
}

export function isLegacyUserValue(value?: string | null) {
  const text = normalize(value);
  if (!text) return false;
  if (LEGACY_EMAILS.has(text)) return true;
  return LEGACY_NAME_PARTS.some((part) => text.includes(part));
}

export function isLegacyProfile(row: any) {
  if (!row) return false;
  if (isAdminProfile(row)) return false;
  return [
    row.email,
    row.firebase_email,
    row.username,
    row.full_name,
    row.displayName,
    row.display_name,
    row.firebase_display_name,
  ].some(isLegacyUserValue);
}

export function isFreshProfile(row: any) {
  if (!row) return false;
  if (isAdminProfile(row)) return true;
  return rowTime(row) >= FRESH_START_AT_MS;
}

export function isHiddenExistingProfile(row: any) {
  if (!row) return false;
  if (isAdminProfile(row)) return false;
  if (isLegacyProfile(row)) return true;
  return !isFreshProfile(row);
}

export function isLegacyMediaRow(row: any) {
  if (!row) return false;
  if (isAdminProfile(row) || isAdminProfile(row.profiles) || isAdminProfile(row.profile)) return false;
  if (isLegacyProfile(row) || isLegacyProfile(row.profiles) || isLegacyProfile(row.profile)) return true;
  if (row.profiles || row.profile) return isHiddenExistingProfile(row.profiles || row.profile);
  return rowTime(row) > 0 && rowTime(row) < FRESH_START_AT_MS;
}

export function hideLegacyRows<T>(rows: T[] | null | undefined): T[] {
  return (rows || []).filter((row: any) => !isHiddenExistingProfile(row) && !isLegacyMediaRow(row));
}
