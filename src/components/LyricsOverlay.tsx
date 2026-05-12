import { useEffect, useRef, useState } from "react";
import { Mic2 } from "lucide-react";

export interface LyricLine {
  time: number; // seconds
  text: string;
}

interface LyricsOverlayProps {
  lyrics: LyricLine[] | null | undefined;
  /** Seconds offset where the track started (for trimmed clips) */
  startOffset?: number;
  /** External time source — if provided, used instead of internal timer */
  currentTime?: number;
  /** Auto-start internal timer */
  autoStart?: boolean;
  className?: string;
}

/**
 * Karaoke-style timed lyrics overlay. Highlights the current line and
 * shows a peek of the next line. Either drive it with `currentTime`
 * (seconds since track start) or let it run its own clock.
 */
export function LyricsOverlay({
  lyrics,
  startOffset = 0,
  currentTime,
  autoStart = true,
  className = "",
}: LyricsOverlayProps) {
  const [internalTime, setInternalTime] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (currentTime !== undefined) return;
    if (!autoStart) return;
    startedAt.current = performance.now();
    let raf = 0;
    const tick = () => {
      if (startedAt.current != null) {
        setInternalTime((performance.now() - startedAt.current) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoStart, currentTime]);

  if (!lyrics || lyrics.length === 0) return null;

  const t = (currentTime ?? internalTime) + startOffset;

  let activeIdx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= t) activeIdx = i;
    else break;
  }
  const current = activeIdx >= 0 ? lyrics[activeIdx] : null;
  const next = activeIdx + 1 < lyrics.length ? lyrics[activeIdx + 1] : null;

  if (!current && !next) return null;

  return (
    <div className={`pointer-events-none flex flex-col items-center gap-1 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-0.5">
        <Mic2 className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/80">Lyrics</span>
      </div>
      {current && (
        <p
          key={activeIdx}
          className="animate-fade-in max-w-[90%] text-center text-base font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-lg"
        >
          {current.text}
        </p>
      )}
      {next && (
        <p className="max-w-[90%] text-center text-xs text-white/60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {next.text}
        </p>
      )}
    </div>
  );
}

/** Parse plain LRC text "[mm:ss.xx] line" into LyricLine[] */
export function parseLRC(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  const re = /\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/g;
  for (const line of lrc.split("\n")) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseFloat(m[2]);
      const text = m[3].trim();
      if (text) out.push({ time: min * 60 + sec, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
