import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Circle, Square, X, Sparkles, Smile } from "lucide-react";
import { toast } from "sonner";

interface Sticker { id: string; emoji: string; x: number; y: number; size: number; }
const STICKER_SET = ["😀","😎","🥳","😍","🔥","💖","✨","🌈","🦄","🌸","⭐","💎","🎉","👑","🌊","🍕","☕","🎵","🚀","💯"];

/**
 * Lightweight in-browser camera with Snapchat-style CSS filters.
 * Captures still photos (PNG) or short MP4 videos (via MediaRecorder),
 * applying the selected filter to the output by drawing the live video
 * frames into an offscreen canvas with the matching filter string.
 */

const FILTERS: { id: string; label: string; css: string; emoji: string }[] = [
  { id: "none",     label: "Original",  css: "none",                                                          emoji: "✨" },
  { id: "warm",     label: "Sunny",     css: "saturate(1.3) contrast(1.05) sepia(0.15) hue-rotate(-8deg)",   emoji: "☀️" },
  { id: "cool",     label: "Cool",      css: "saturate(1.1) contrast(1.05) hue-rotate(15deg) brightness(1.05)", emoji: "❄️" },
  { id: "vintage",  label: "Vintage",   css: "sepia(0.45) contrast(1.05) saturate(1.2) brightness(0.95)",    emoji: "📷" },
  { id: "noir",     label: "Noir",      css: "grayscale(1) contrast(1.2) brightness(1.05)",                  emoji: "🎞️" },
  { id: "dream",    label: "Dream",     css: "blur(0.4px) saturate(1.4) brightness(1.1) contrast(0.95)",     emoji: "💭" },
  { id: "neon",     label: "Neon",      css: "saturate(2) contrast(1.2) hue-rotate(280deg)",                 emoji: "🟣" },
  { id: "glow",     label: "Glow",      css: "brightness(1.18) saturate(1.2) contrast(1.05)",                emoji: "🌟" },
  { id: "retro",    label: "Retro",     css: "sepia(0.35) hue-rotate(-25deg) saturate(1.3)",                 emoji: "📼" },
  { id: "matrix",   label: "Matrix",    css: "hue-rotate(85deg) saturate(1.6) contrast(1.1)",                emoji: "🟢" },
];

interface Props {
  /** Returns the captured file (image/png or video/mp4|webm) along with whether it's a video. */
  onCapture: (file: File, isVideo: boolean, previewUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [error, setError] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const addSticker = (emoji: string) => {
    setStickers((s) => [...s, { id: `${Date.now()}-${Math.random()}`, emoji, x: 0.5, y: 0.5, size: 0.18 }]);
    setShowStickerPicker(false);
  };
  const removeSticker = (id: string) => setStickers((s) => s.filter((x) => x.id !== id));

  const onStickerPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragRef.current = { id, offsetX: e.clientX - rect.left - rect.width / 2, offsetY: e.clientY - rect.top - rect.height / 2 };
    el.setPointerCapture(e.pointerId);
  };
  const onStickerPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !stageRef.current) return;
    const stage = stageRef.current.getBoundingClientRect();
    const nx = (e.clientX - stage.left - dragRef.current.offsetX) / stage.width;
    const ny = (e.clientY - stage.top - dragRef.current.offsetY) / stage.height;
    setStickers((arr) => arr.map((s) => s.id === dragRef.current!.id ? { ...s, x: Math.max(0.05, Math.min(0.95, nx)), y: Math.max(0.05, Math.min(0.95, ny)) } : s));
  };
  const onStickerPointerUp = () => { dragRef.current = null; };

  const drawStickersToCanvas = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.filter = "none";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const s of stickers) {
      const px = s.size * h;
      ctx.font = `${px}px serif`;
      ctx.fillText(s.emoji, s.x * w, s.y * h);
    }
    ctx.restore();
  };

  // Acquire camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Stop any prior stream first
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message || "Camera access denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [facing]);

  useEffect(() => {
    if (!recording) { setRecordTime(0); return; }
    const start = Date.now();
    const id = setInterval(() => setRecordTime(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [recording]);

  const takePhoto = () => {
    const v = videoRef.current; if (!v) return;
    const w = v.videoWidth, h = v.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filter.css;
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    // Reset transform so stickers aren't mirrored
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawStickersToCanvas(ctx, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.png`, { type: "image/png" });
      onCapture(file, false, URL.createObjectURL(blob));
    }, "image/png", 0.95);
  };

  const startVideo = () => {
    const v = videoRef.current; const stream = streamRef.current;
    if (!v || !stream) return;

    // Render filtered frames into a canvas and capture that canvas + original audio.
    const w = v.videoWidth, h = v.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      ctx.filter = filter.css;
      ctx.save();
      if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(v, 0, 0, w, h);
      ctx.restore();
      drawStickersToCanvas(ctx, w, h);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvas.captureStream(30);
    const audio = stream.getAudioTracks()[0];
    if (audio) canvasStream.addTrack(audio);

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
    const rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const type = rec.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `reel-${Date.now()}.${ext}`, { type });
      onCapture(file, true, URL.createObjectURL(blob));
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopVideo = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background p-6 text-center">
        <Camera className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground font-semibold">Camera unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{error}</p>
        <button onClick={onClose} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Close</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      {/* top bar */}
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={onClose} aria-label="Close camera"><X className="h-6 w-6" /></button>
        {recording && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, "0")}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={() => setShowStickerPicker((v) => !v)} aria-label="Stickers" title="Stickers">
            <Smile className="h-6 w-6" />
          </button>
          <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Flip camera">
            <RefreshCw className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* live preview */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden bg-black"
        onPointerMove={onStickerPointerMove} onPointerUp={onStickerPointerUp}>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: filter.css, transform: facing === "user" ? "scaleX(-1)" : "none" }}
          playsInline
          muted
        />
        {/* sticker overlay */}
        {stickers.map((s) => (
          <div
            key={s.id}
            onPointerDown={(e) => onStickerPointerDown(e, s.id)}
            onDoubleClick={() => removeSticker(s.id)}
            className="absolute select-none touch-none cursor-grab active:cursor-grabbing"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, transform: "translate(-50%, -50%)", fontSize: `${s.size * 100}vh`, lineHeight: 1 }}
            title="Drag to move • Double-tap to remove"
          >
            {s.emoji}
          </div>
        ))}

        {/* Sticker picker */}
        {showStickerPicker && (
          <div className="absolute right-3 top-3 max-w-[220px] rounded-2xl bg-black/80 p-2 backdrop-blur grid grid-cols-5 gap-1">
            {STICKER_SET.map((e) => (
              <button key={e} onClick={() => addSticker(e)} className="text-2xl rounded-lg p-1 hover:bg-white/10">{e}</button>
            ))}
          </div>
        )}

        {/* Sticker toggle button */}
        <button
          onClick={() => setShowStickerPicker((v) => !v)}
          className="absolute right-3 top-3 hidden"
          aria-label="Stickers"
        />

        {/* filter chips */}
        <div className="absolute bottom-3 left-0 right-0 px-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {FILTERS.map((f) => {
              const active = f.id === filter.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-semibold transition-all ${
                    active ? "bg-primary text-primary-foreground scale-105" : "bg-black/50 text-white backdrop-blur"
                  }`}
                >
                  <span className="text-base leading-none">{f.emoji}</span>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="bg-black px-4 pt-3 pb-6 text-white">
        <div className="mb-3 flex justify-center gap-2">
          {(["photo", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => !recording && setMode(m)}
              className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider ${
                mode === m ? "bg-white text-black" : "text-white/60"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center">
          {mode === "photo" ? (
            <button
              onClick={takePhoto}
              aria-label="Take photo"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 active:scale-95 transition-transform"
            >
              <Circle className="h-14 w-14 fill-white text-white" />
            </button>
          ) : recording ? (
            <button
              onClick={stopVideo}
              aria-label="Stop recording"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/30 active:scale-95"
            >
              <Square className="h-10 w-10 fill-red-500 text-red-500" />
            </button>
          ) : (
            <button
              onClick={startVideo}
              aria-label="Start recording"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-red-500/40 active:scale-95"
            >
              <Circle className="h-12 w-12 fill-red-500 text-red-500" />
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/60">
          <Sparkles className="h-3 w-3" /> Filter: {filter.label}
        </p>
      </div>
    </div>
  );
}
