type KnownProfile = {
  username: string;
  fullName: string;
};

const ADMIN_EMAIL = "muhilsiddhesh.in@gmail.com";
const ADMIN_FIREBASE_UID = "nxANfkUL63MSTv300eH6rSICw9w1";

const KNOWN_PROFILES: Record<string, KnownProfile> = {
  "muhilsiddhesh.in@gmail.com": { username: "muhilsiddhesh", fullName: "Muhil Siddhesh" },
};

export function getKnownProfile(email?: string | null) {
  if (!email) return null;
  return KNOWN_PROFILES[email.toLowerCase()] || null;
}

export function listKnownProfiles() {
  return Object.entries(KNOWN_PROFILES).map(([email, profile]) => ({
    id: `known:${email}`,
    user_id: `known:${email}`,
    email,
    username: profile.username,
    full_name: profile.fullName,
    avatar_url: "",
    is_verified: false,
    is_known_only: true,
  }));
}

export function listVisibleKnownProfiles() {
  const profile = KNOWN_PROFILES[ADMIN_EMAIL];
  return [{
    id: ADMIN_FIREBASE_UID,
    user_id: ADMIN_FIREBASE_UID,
    email: ADMIN_EMAIL,
    username: profile.username,
    full_name: profile.fullName,
    avatar_url: "",
    is_verified: true,
    is_known_only: false,
  }];
}
