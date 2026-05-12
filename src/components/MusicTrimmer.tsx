import { Slider } from "@/components/ui/slider";
import { Scissors } from "lucide-react";

interface MusicTrimmerProps {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  max?: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Pick start and end seconds for a YouTube background song. */
export function MusicTrimmer({ start, end, onChange, max = 180 }: MusicTrimmerProps) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <Scissors className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">Trim song</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {fmt(start)} → {fmt(end)} ({end - start}s)
        </span>
      </div>
      <Slider
        min={0}
        max={max}
        step={1}
        value={[start, end]}
        onValueChange={(vals) => {
          const [a, b] = vals;
          if (b - a < 3) return;
          onChange(a, b);
        }}
      />
    </div>
  );
}
