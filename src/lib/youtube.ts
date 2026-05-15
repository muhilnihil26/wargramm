export function getYouTubeId(input: string | null | undefined): string | null {
  let value = (input || "").trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original text if a pasted URL has a malformed escape sequence.
  }
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return isYouTubeId(id) ? id : null;
    }

    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const watchId = url.searchParams.get("v");
      if (isYouTubeId(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part));
      if (marker >= 0 && isYouTubeId(parts[marker + 1])) return parts[marker + 1];
    }
  } catch {
    // Fall back to regex for pasted text that contains a URL.
  }

  const match = value.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/i);
  if (match?.[1]) return match[1];

  const loose = value.match(/(?:^|[?&#/\s=])([\w-]{11})(?:[?&#/\s]|$)/);
  return isYouTubeId(loose?.[1]) ? loose![1] : null;
}

export function getPlaylistId(input: string | null | undefined): string | null {
  const value = (input || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.searchParams.get("list");
  } catch {
    const match = value.match(/[?&]list=([\w-]+)/);
    return match?.[1] || null;
  }
}

export function youtubeThumbnail(input: string | null | undefined): string | null {
  const id = getYouTubeId(input);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function normalizeYouTubeUrl(input: string): string {
  const videoId = getYouTubeId(input);
  const playlistId = getPlaylistId(input);
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${encodeURIComponent(playlistId)}` : ""}`;
  if (playlistId) return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  return input.trim();
}

export function youtubeEmbedUrl(
  input: string,
  options: { playlistId?: string | null; start?: number | null; end?: number | null; autoplay?: boolean; loop?: boolean; mute?: boolean } = {},
): string {
  const playlistId = options.playlistId || getPlaylistId(input);
  const videoId = getYouTubeId(input);
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    fs: "1",
  });
  if (typeof window !== "undefined" && /^https?:/.test(window.location.origin)) {
    params.set("origin", window.location.origin);
  }

  if (options.autoplay) params.set("autoplay", "1");
  if (options.mute) params.set("mute", "1");
  if (typeof options.start === "number" && options.start > 0) params.set("start", String(Math.floor(options.start)));
  if (typeof options.end === "number" && options.end > (options.start || 0)) params.set("end", String(Math.floor(options.end)));

  if (!videoId && playlistId) {
    params.set("list", playlistId);
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }

  if (!videoId) return "";
  if (options.loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function youtubeWatchUrl(input: string | null | undefined): string {
  const videoId = getYouTubeId(input);
  const playlistId = getPlaylistId(input);
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${encodeURIComponent(playlistId)}` : ""}`;
  if (playlistId) return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  return String(input || "");
}

function isYouTubeId(value: string | null | undefined): value is string {
  return /^[\w-]{11}$/.test(value || "");
}
