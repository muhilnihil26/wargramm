import { ExternalLink } from "lucide-react";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube";

type YouTubeEmbedFrameProps = {
  url: string;
  title?: string;
  start?: number | null;
  end?: number | null;
  playlistId?: string | null;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
};

export function YouTubeEmbedFrame({ url, title = "YouTube", start, end, playlistId, className = "", autoplay = false, muted = false }: YouTubeEmbedFrameProps) {
  const src = youtubeEmbedUrl(url, { playlistId, start, end, autoplay, mute: muted });

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      {src ? (
        <iframe
          key={src}
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white/70">
          This YouTube link could not be loaded.
        </div>
      )}
      <a
        href={youtubeWatchUrl(url)}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-3 z-10 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur"
        onClick={(event) => event.stopPropagation()}
        aria-label="Open on YouTube"
      >
        <ExternalLink className="inline h-3 w-3" /> YouTube
      </a>
    </div>
  );
}
