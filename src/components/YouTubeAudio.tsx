import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { getYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";

interface YouTubeAudioProps {
  url: string;
  title?: string;
  start?: number;
  end?: number;
  autoPlay?: boolean;
  compact?: boolean;
}

/**
 * Plays YouTube audio via a hidden iframe. Used as background music for posts/stories/reels.
 * Browsers require user interaction before audio can play unmuted, so we expose a tap-to-unmute control.
 */
export function YouTubeAudio({ url, title, start = 0, end, autoPlay = true, compact = false }: YouTubeAudioProps) {
  const videoId = getYouTubeId(url);
  const [muted, setMuted] = useState(true); // Start muted so autoplay works
  const [playing, setPlaying] = useState(autoPlay);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!videoId) return null;

  const params = new URLSearchParams({
    autoplay: autoPlay ? "1" : "0",
    mute: muted ? "1" : "0",
    controls: "0",
    loop: "1",
    playlist: videoId,
    start: String(Math.max(0, start)),
    ...(end && end > start ? { end: String(end) } : {}),
    enablejsapi: "1",
    playsinline: "1",
  });

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    // Reload iframe with new mute state
    if (iframeRef.current) {
      const cmd = next ? "mute" : "unMute";
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: cmd, args: [] }),
        "*"
      );
    }
  };

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2"}>
      {/* Hidden iframe for audio playback */}
      <iframe
        ref={iframeRef}
        src={`${youtubeEmbedUrl(url, { start, end, autoplay: autoPlay, loop: true, mute: muted })}&controls=${params.get("controls") || "0"}`}
        allow="autoplay; encrypted-media"
        className="h-0 w-0 border-0 opacity-0 pointer-events-none absolute"
        style={{ position: "absolute", left: "-9999px" }}
        title="background music"
      />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Music className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs text-foreground/90 truncate">{title || "Original Audio"}</span>
      </div>
      <button onClick={handleToggleMute} className="text-muted-foreground hover:text-foreground" aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
      </button>
    </div>
  );
}
