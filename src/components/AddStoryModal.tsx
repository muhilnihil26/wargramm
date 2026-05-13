import { useEffect, useState, useRef } from "react";
import { X, Camera, Loader2, Globe, Users, Lock, Type, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mediaOwnerPayload } from "@/lib/firebaseMedia";
import { isUuid } from "@/lib/ids";
import { readLocalProfile } from "@/lib/localProfile";
import { logCloudAction } from "@/lib/cloudActions";
import { saveFirebaseMedia } from "@/lib/firebaseUserData";

interface AddStoryModalProps {
  onClose: () => void;
}

type Visibility = "public" | "followers" | "only_me";

export function AddStoryModal({ onClose }: AddStoryModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [uploading, setUploading] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [template, setTemplate] = useState("linear-gradient(135deg,#1f2937,#111827)");

  const { data: profile } = useQuery({
    queryKey: ["story-profile-privacy", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user || !isUuid(user.id)) return readLocalProfile(user) as any;
      const { data } = await supabase.from("profiles").select("is_private").eq("user_id", user!.id).maybeSingle();
      return data as { is_private?: boolean } | null;
    },
  });

  useEffect(() => {
    if (profile?.is_private) setVisibility("followers");
  }, [profile?.is_private]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setIsVideo(f.type.startsWith("video/"));
  };

  const buildTextStory = () => {
    const clean = storyText.trim().slice(0, 120);
    if (!clean) return null;
    const lines = clean.match(/.{1,18}(\\s|$)/g)?.slice(0, 5).map((s) => s.trim()) || [clean];
    const colors = template.match(/#[0-9a-fA-F]{6}/g) || ["#1f2937", "#111827"];
    const text = lines.map((line, i) => (
      `<text x="540" y="${700 + i * 72}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="white">${line.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))}</text>`
    )).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1] || colors[0]}"/></linearGradient></defs>
      <rect width="1080" height="1920" fill="url(#g)"/>
      <text x="540" y="560" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="rgba(255,255,255,.72)">thinking...</text>
      ${text}
    </svg>`;
    return new File([new Blob([svg], { type: "image/svg+xml" })], `thought-${Date.now()}.svg`, { type: "image/svg+xml" });
  };

  const handleTextPreview = () => {
    const generated = buildTextStory();
    if (!generated) {
      toast.error("Write something first");
      return;
    }
    setFile(generated);
    setIsVideo(false);
    setPreview(URL.createObjectURL(generated));
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/story_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(path);
      const { error } = await supabase.from("stories").insert({
        ...mediaOwnerPayload(user),
        image_url: publicUrl,
        is_video: isVideo,
        caption: textMode ? storyText.trim() : null,
        visibility,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);
      if (error) {
        await saveFirebaseMedia("story", user, {
          image_url: publicUrl,
          is_video: isVideo,
          caption: textMode ? storyText.trim() : null,
          visibility,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["stories"] });
      await logCloudAction(user, "story_create", { visibility, type: isVideo ? "video" : textMode ? "thought" : "image", firebase_fallback: !!error }).catch(() => {});
      toast.success(error ? "Story media uploaded and saved to Firebase cloud" : "Story added!");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose}><X className="h-6 w-6 text-white" /></button>
        <h2 className="text-lg font-bold text-white">Add Story</h2>
        {preview ? (
          <button onClick={handleUpload} disabled={uploading} className="text-sm font-bold text-primary disabled:opacity-50">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Share"}
          </button>
        ) : <div className="w-12" />}
      </div>

      {!preview ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <input type="file" accept="image/*,video/*" ref={fileRef} onChange={handleSelect} className="hidden" />
          {textMode ? (
            <div className="w-full max-w-sm space-y-4">
              <div className="rounded-[2rem] p-5 text-center" style={{ background: template }}>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-white/70">thinking...</p>
                <textarea
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value.slice(0, 120))}
                  rows={5}
                  placeholder="Write a thought"
                  className="w-full resize-none bg-transparent text-center text-3xl font-extrabold leading-tight text-white outline-none placeholder:text-white/45"
                />
              </div>
              <div className="flex gap-2">
                {[
                  "linear-gradient(135deg,#1f2937,#111827)",
                  "linear-gradient(135deg,#f97316,#db2777)",
                  "linear-gradient(135deg,#0f766e,#2563eb)",
                ].map((bg) => (
                  <button key={bg} onClick={() => setTemplate(bg)} className="h-10 flex-1 rounded-full border border-white/20" style={{ background: bg }} aria-label="Story template" />
                ))}
              </div>
              <button onClick={handleTextPreview} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">Preview thought</button>
              <button onClick={() => setTextMode(false)} className="w-full text-sm font-semibold text-white/70">Use photo or video</button>
            </div>
          ) : (
            <>
              <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full border-2 border-white/30 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-white/60" />
                </div>
                <p className="text-white/60 text-sm">Tap to select photo or video</p>
              </button>
              <button onClick={() => setTextMode(true)} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white">
                <Type className="h-4 w-4" /> Thinking template
                <Palette className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center">
            {isVideo ? (
              <video src={preview} className="max-h-full max-w-full" autoPlay loop muted playsInline />
            ) : (
              <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>

          <div className="px-4 py-3 bg-black/80 border-t border-white/10">
            <p className="text-xs text-white/60 mb-2">Who can see this story?</p>
            <div className="flex gap-2">
              {([
                { v: "public", label: "Public", icon: Globe },
                { v: "followers", label: "Followers", icon: Users },
                { v: "only_me", label: "Only me", icon: Lock },
              ] as { v: Visibility; label: string; icon: typeof Globe }[]).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                    visibility === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-white/30 text-white/80 bg-transparent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
