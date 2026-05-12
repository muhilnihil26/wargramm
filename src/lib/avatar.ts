export function defaultAvatar(seed?: string | null, label?: string | null) {
  const name = (label || seed || "User").trim();
  const initial = (name[0] || "U").toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="80" fill="hsl(${hue} 60% 22%)"/>
      <circle cx="80" cy="66" r="30" fill="hsl(${hue} 70% 78%)"/>
      <path d="M28 146c8-34 30-51 52-51s44 17 52 51" fill="hsl(${hue} 70% 78%)"/>
      <text x="80" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="white">${initial}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function profileAvatar(src?: string | null, seed?: string | null, label?: string | null) {
  return src || defaultAvatar(seed, label);
}
