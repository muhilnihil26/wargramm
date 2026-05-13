type KnownProfile = {
  username: string;
  fullName: string;
};

const KNOWN_PROFILES: Record<string, KnownProfile> = {
  "infantjeril442@gmail.com": { username: "infantjeril442", fullName: "Infant Jeril" },
  "nihilyadesh2015@gmail.com": { username: "nihilyadesh2015", fullName: "Nihil Yadesh" },
  "sanjanashreer682@gmail.com": { username: "sanjanashreer682", fullName: "Sanjana Shree" },
  "mithresh0205@gmail.com": { username: "mithresh0205", fullName: "Mithresh" },
  "yazhinimanikumar@gmail.com": { username: "yazhinimanikumar", fullName: "Yazhini Manikumar" },
  "mmugeshdharan@gmail.com": { username: "mmugeshdharan", fullName: "M Mugesh Dharan" },
  "5b.vrrithikamfts@gmail.com": { username: "vrrithikamfts", fullName: "Vrrithika" },
  "ananya2505123456@gmail.com": { username: "ananya2505123456", fullName: "Ananya" },
  "dharunashok011@gmail.com": { username: "dharunashok011", fullName: "Dharun Ashok" },
  "tamilselvanask7@gmail.com": { username: "tamilselvanask7", fullName: "Tamil Selvan" },
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
