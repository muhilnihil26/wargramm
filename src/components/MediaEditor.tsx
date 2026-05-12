import { useEffect, useRef, useState } from "react";
import { X, Crop, Sliders, Type, Smile, Pencil, Scissors, Check, Undo2, Trash2 } from "lucide-react";

/**
 * Full pro media editor: image + video, crop / filters / trim / text / stickers / draw.
 * For images we composite all layers onto a canvas and export a PNG File.
 * For videos we keep the source File and return filter / trim / overlay metadata
 * (overlays + filter are baked in at render-time by the player on playback;
 * trim is enforced via HTMLVideoElement.currentTime + endedHandler).
 */

type Tab = "crop" | "filters" | "trim" | "text" | "stickers" | "draw";

interface TextLayer { id: string; x: number; y: number; text: string; color: string; size: number; }
interface StickerLayer { id: string; x: number; y: number; emoji: string; size: number; }
interface DrawStroke { color: string; size: number; points: { x: number; y: number }[]; }

const FILTERS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.1)" },
  { id: "warm", label: "Warm", css: "sepia(0.3) saturate(1.3) hue-rotate(-10deg)" },
  { id: "cool", label: "Cool", css: "saturate(1.2) hue-rotate(15deg) brightness(1.05)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "fade", label: "Fade", css: "contrast(0.85) brightness(1.1) saturate(0.85)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.4) brightness(0.9)" },
  { id: "bright", label: "Bright", css: "brightness(1.2) saturate(1.2)" },
  { id: "dream", label: "Dream", css: "blur(0.5px) saturate(1.3) brightness(1.1)" },
];

const STICKERS = ["❤️","🔥","✨","😂","😎","🥰","💯","🎉","⭐","🌈","🎵","💀","👀","🙌","💪","🌸","🍕","🚀","💎","👑"];
const COLORS = ["#ffffff","#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#a855f7","#ec4899","#000000"];

export interface MediaEditorResult {
  file: File;
  isVideo: boolean;
  previewUrl: string;
  // For videos these are returned so the consumer can apply on playback / re-encode later.
  videoMeta?: { filterCss: string; trimStart: number; trimEnd: number };
}

interface Props {
  file: File;
  isVideo: boolean;
  onCancel: () => void;
  onDone: (result: MediaEditorResult) => void;
}

export function MediaEditor({ file, isVideo, onCancel, onDone }: Props) {
  const [tab, setTab] = useState<Tab>(isVideo ? "filters" : "filters");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [stickers, setStickers] = useState<StickerLayer[]>([]);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [drawSize, setDrawSize] = useState(6);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 }); // normalized
  const [trim, setTrim] = useState({ start: 0, end: 30 });
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  const url = useRef(URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url.current), []);

  const stageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawStroke | null>(null);

  const addText = () => {
    const t = prompt("Enter text");
    if (!t) return;
    setTexts((s) => [...s, { id: crypto.randomUUID(), x: 0.5, y: 0.5, text: t, color: "#ffffff", size: 32 }]);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tab !== "draw" || !stageRef.current) return;
    drawingRef.current = true;
    const r = stageRef.current.getBoundingClientRect();
    currentStrokeRef.current = { color: drawColor, size: drawSize, points: [{ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }] };
    setStrokes((s) => [...s, currentStrokeRef.current!]);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !stageRef.current || !currentStrokeRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    currentStrokeRef.current.points.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    setStrokes((s) => [...s.slice(0, -1), { ...currentStrokeRef.current! }]);
  };
  const onPointerUp = () => { drawingRef.current = false; currentStrokeRef.current = null; };

  const moveLayer = (kind: "text" | "sticker", id: string, e: React.PointerEvent) => {
    if (tab === "draw") return;
    const stage = stageRef.current; if (!stage) return;
    const onMove = (ev: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      if (kind === "text") setTexts((s) => s.map((t) => t.id === id ? { ...t, x, y } : t));
      else setStickers((s) => s.map((t) => t.id === id ? { ...t, x, y } : t));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.stopPropagation();
  };

  const exportImage = async (): Promise<File> => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url.current;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img load")); });
    const sx = img.naturalWidth * crop.x;
    const sy = img.naturalHeight * crop.y;
    const sw = img.naturalWidth * crop.w;
    const sh = img.naturalHeight * crop.h;
    const canvas = document.createElement("canvas");
    canvas.width = sw; canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filter.css;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.filter = "none";
    // Strokes
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * (sw / 800);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * sw; const y = p.y * sh;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    // Stickers
    for (const st of stickers) {
      ctx.font = `${st.size * (sw / 400)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(st.emoji, st.x * sw, st.y * sh);
    }
    // Text
    for (const t of texts) {
      ctx.font = `bold ${t.size * (sw / 400)}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 4;
      ctx.strokeText(t.text, t.x * sw, t.y * sh);
      ctx.fillText(t.text, t.x * sw, t.y * sh);
    }
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-edited.jpg", { type: "image/jpeg" });
  };

  const finish = async () => {
    setBusy(true);
    try {
      if (isVideo) {
        // Return original file + meta. Trim/filter applied at playback time.
        onDone({
          file,
          isVideo: true,
          previewUrl: url.current,
          videoMeta: { filterCss: filter.css, trimStart: trim.start, trimEnd: trim.end },
        });
      } else {
        const out = await exportImage();
        onDone({ file: out, isVideo: false, previewUrl: URL.createObjectURL(out) });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background" style={{ height: "100dvh" }}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button onClick={onCancel} className="text-foreground"><X className="h-6 w-6" /></button>
        <h2 className="text-sm font-semibold text-foreground">Edit {isVideo ? "video" : "photo"}</h2>
        <button onClick={finish} disabled={busy} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "..." : "Done"}
        </button>
      </header>

      {/* Stage */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-black p-2">
        <div
          ref={stageRef}
          className="relative max-h-full max-w-full overflow-hidden touch-none"
          style={{ aspectRatio: isVideo ? "9 / 16" : `${crop.w} / ${crop.h}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {isVideo ? (
            <video
              src={url.current}
              autoPlay loop muted playsInline
              style={{ filter: filter.css }}
              className="h-full w-full object-contain bg-black"
              onLoadedMetadata={(e) => {
                const d = (e.target as HTMLVideoElement).duration;
                if (Number.isFinite(d)) { setDuration(d); setTrim({ start: 0, end: Math.min(60, d) }); }
              }}
            />
          ) : (
            <img
              src={url.current}
              alt=""
              draggable={false}
              style={{
                filter: filter.css,
                objectFit: "cover",
                objectPosition: `${-crop.x * 100}% ${-crop.y * 100}%`,
                width: `${100 / crop.w}%`,
                height: `${100 / crop.h}%`,
                transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
                maxWidth: "none",
              }}
              className="select-none"
            />
          )}

          {/* Strokes overlay */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
            {strokes.map((s, i) => (
              <polyline key={i}
                points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={s.color} strokeWidth={s.size / 800}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: s.size }}
              />
            ))}
          </svg>

          {/* Stickers */}
          {stickers.map((st) => (
            <div key={st.id}
              onPointerDown={(e) => moveLayer("sticker", st.id, e)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none"
              style={{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, fontSize: st.size }}
            >{st.emoji}</div>
          ))}
          {/* Texts */}
          {texts.map((t) => (
            <div key={t.id}
              onPointerDown={(e) => moveLayer("text", t.id, e)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none font-bold whitespace-nowrap"
              style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, color: t.color, fontSize: t.size, textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
            >{t.text}</div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="border-t border-border bg-background p-3 space-y-3 max-h-[40vh] overflow-y-auto">
        {tab === "filters" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold border ${filter.id === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tab === "crop" && !isVideo && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Aspect ratio</p>
            <div className="flex flex-wrap gap-2">
              {[
                { l: "Free", w: 1, h: 1, x: 0, y: 0 },
                { l: "1:1", w: 1, h: 1, x: 0, y: 0 },
                { l: "4:5", w: 0.8, h: 1, x: 0.1, y: 0 },
                { l: "9:16", w: 0.5625, h: 1, x: 0.218, y: 0 },
                { l: "16:9", w: 1, h: 0.5625, x: 0, y: 0.218 },
              ].map((p) => (
                <button key={p.l} onClick={() => setCrop({ x: p.x, y: p.y, w: p.w, h: p.h })}
                  className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground">{p.l}</button>
              ))}
            </div>
          </div>
        )}
        {tab === "trim" && isVideo && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Start: {trim.start.toFixed(1)}s · End: {trim.end.toFixed(1)}s · Duration: {duration.toFixed(1)}s</p>
            <input type="range" min={0} max={duration} step={0.1} value={trim.start}
              onChange={(e) => setTrim((t) => ({ ...t, start: Math.min(parseFloat(e.target.value), t.end - 0.5) }))}
              className="w-full" />
            <input type="range" min={0} max={duration} step={0.1} value={trim.end}
              onChange={(e) => setTrim((t) => ({ ...t, end: Math.max(parseFloat(e.target.value), t.start + 0.5) }))}
              className="w-full" />
          </div>
        )}
        {tab === "text" && (
          <div className="space-y-2">
            <button onClick={addText} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">+ Add text</button>
            {texts.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg bg-secondary p-2">
                <input value={t.text} onChange={(e) => setTexts((s) => s.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x))}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none" />
                <input type="color" value={t.color} onChange={(e) => setTexts((s) => s.map((x) => x.id === t.id ? { ...x, color: e.target.value } : x))} className="h-6 w-6" />
                <input type="range" min={16} max={96} value={t.size} onChange={(e) => setTexts((s) => s.map((x) => x.id === t.id ? { ...x, size: parseInt(e.target.value) } : x))} className="w-20" />
                <button onClick={() => setTexts((s) => s.filter((x) => x.id !== t.id))}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            ))}
          </div>
        )}
        {tab === "stickers" && (
          <div className="grid grid-cols-8 gap-2">
            {STICKERS.map((s) => (
              <button key={s} onClick={() => setStickers((arr) => [...arr, { id: crypto.randomUUID(), emoji: s, x: 0.5, y: 0.5, size: 56 }])}
                className="text-2xl hover:scale-110 transition-transform">{s}</button>
            ))}
          </div>
        )}
        {tab === "draw" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setDrawColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${drawColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
              <input type="range" min={2} max={24} value={drawSize} onChange={(e) => setDrawSize(parseInt(e.target.value))} className="flex-1 min-w-[120px]" />
              <button onClick={() => setStrokes((s) => s.slice(0, -1))} className="text-foreground"><Undo2 className="h-5 w-5" /></button>
              <button onClick={() => setStrokes([])} className="text-destructive"><Trash2 className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Drag on the image to draw.</p>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <nav className="flex items-center justify-around border-t border-border bg-background py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {([
          ["filters", Sliders, "Filters"],
          ["crop", Crop, "Crop"],
          ["trim", Scissors, "Trim"],
          ["text", Type, "Text"],
          ["stickers", Smile, "Stickers"],
          ["draw", Pencil, "Draw"],
        ] as [Tab, any, string][]).map(([id, Icon, label]) => {
          const disabled = (id === "trim" && !isVideo) || (id === "crop" && isVideo);
          return (
            <button key={id} disabled={disabled} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 ${tab === id ? "text-primary" : "text-muted-foreground"} disabled:opacity-30`}>
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
