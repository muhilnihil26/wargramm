import { useState, useRef, useEffect } from "react";
import { Plus, Loader2, X, Volume2, VolumeX, Gauge, Camera, Link as LinkIcon, Globe, Users, Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReelItem } from "@/components/ReelItem";
import { ShareSheet } from "@/components/ShareSheet";
import { MusicTrimmer } from "@/components/MusicTrimmer";
import { rewardForReel } from "@/lib/coins";
import { profileAvatar } from "@/lib/avatar";

const YT_URL_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/;

const Reels = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  void navigate;
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [musicStart, setMusicStart] = useState(0);
  const [musicEnd, setMusicEnd] = useState(30);
  const [ytUrl, setYtUrl] = useState("");
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [shareReel, setShareReel] = useState<any | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "only_me">("public");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Receive remix request from home feed: open uploader with audio pre-filled
  useEffect(() => {
    const state = location.state as { remixMusicUrl?: string; remixMusicTitle?: string } | null;
    if (state?.remixMusicUrl) {
      setMusicUrl(state.remixMusicUrl);
      if (state.remixMusicTitle) setMusicTitle(state.remixMusicTitle);
      setShowUpload(true);
      toast.info("Remix: audio loaded — pick your video");
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  // All authenticated users can post Reels.

  const { data: library = [] } = useQuery({
    queryKey: ["music-library"],
    queryFn: async () => {
      const { data } = await supabase.from("music").select("id, title, youtube_url").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["reels-profile-privacy", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_private").eq("user_id", user!.id).maybeSingle();
      return data as { is_private?: boolean } | null;
    },
  });

  useEffect(() => {
    if (profile?.is_private) setVisibility("followers");
  }, [profile?.is_private]);

  const { data: dbReels = [], refetch } = useQuery({
    queryKey: ["reels"],
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return [];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", userIds);
      return data.map((r: any) => ({
        ...r,
        username: profiles?.find((p: any) => p.user_id === r.user_id)?.username || "user",
        avatar: profileAvatar(profiles?.find((p: any) => p.user_id === r.user_id)?.avatar_url, r.user_id, profiles?.find((p: any) => p.user_id === r.user_id)?.username),
      }));
    },
  });

  const handleShare = (reel: any) => setShareReel(reel);

  const handleRemix = (reel: any) => {
    setMusicUrl(reel.musicUrl || "");
    setShowUpload(true);
    toast.info("Remix: same audio loaded — pick your video");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadReel = async () => {
    if (!user) return;
    

    // Path A: YouTube URL → store as a reel pointing to the YouTube URL
    if (ytUrl.trim()) {
      if (!YT_URL_RE.test(ytUrl.trim())) { toast.error("Paste a valid YouTube video or Shorts URL"); return; }
      setUploading(true);
      try {
        const { error } = await supabase.from("reels").insert({
          user_id: user.id,
          video_url: ytUrl.trim(),
          caption,
          visibility,
          music_url: null,
          music_title: musicTitle || null,
          music_start: musicStart || 0,
          music_end: musicEnd || 60,
        } as any);
        if (error) throw error;
        await rewardForReel(user.id);
        toast.success("YouTube reel added!");
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setUploading(false);
      }
    } else if (selectedFile) {
      // Path B: file upload (NO time limit — Reels accepts any length)
      setUploading(true);
      try {
        const ext = selectedFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("reels").upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("reels").getPublicUrl(path);
        const { error: insertErr } = await supabase.from("reels").insert({
          user_id: user.id,
          video_url: publicUrl,
          caption,
          visibility,
          music_url: musicUrl || null,
          music_title: musicTitle || null,
          music_start: musicUrl ? musicStart : 0,
          music_end: musicUrl ? musicEnd : 30,
        } as any);
        if (insertErr) throw insertErr;
        await rewardForReel(user.id);
        toast.success("Reel uploaded!");
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setUploading(false);
      }
    } else {
      toast.error("Pick a video or paste a YouTube URL"); return;
    }
    setShowUpload(false);
    setSelectedFile(null);
    setPreview(null);
    setCaption("");
    setMusicUrl("");
    setMusicTitle("");
    setMusicStart(0);
    setMusicEnd(30);
    setYtUrl("");
    setVisibility("public");
    refetch();
  };

  const allReels = dbReels.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar,
    video: r.video_url,
    caption: r.caption || "",
    music: r.music_title || "Original Audio",
    musicUrl: r.music_url as string | null,
    musicStart: r.music_start as number | null,
    musicEnd: r.music_end as number | null,
    lyrics: (r.lyrics as any) || null,
  }));

  if (showUpload) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
          <button onClick={() => { setShowUpload(false); setPreview(null); setSelectedFile(null); setYtUrl(""); }}>
            <X className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">New Reel</h1>
          <button onClick={handleUploadReel} disabled={(!selectedFile && !ytUrl.trim()) || uploading} className="text-sm font-bold text-primary disabled:opacity-50">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Share"}
          </button>
        </header>
        <div className="mx-auto max-w-lg p-4 space-y-4">
          <input type="file" accept="video/*,image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
          {preview ? (
            <video src={preview} className="w-full aspect-[9/16] rounded-xl object-cover bg-secondary" controls />
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-[9/16] rounded-xl bg-secondary flex flex-col items-center justify-center gap-3">
              <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">Select video (any length)</p>
            </button>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-secondary p-3">
            <LinkIcon className="h-4 w-4 text-primary shrink-0" />
            <input placeholder="…or paste a YouTube video / Shorts URL" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          <textarea placeholder="Write a caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full rounded-xl bg-secondary p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" rows={3} />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Who can see this reel?</p>
            <div className="flex gap-2">
              {([
                { v: "public", label: "Everyone", icon: Globe },
                { v: "followers", label: "Followers", icon: Users },
                { v: "only_me", label: "Only me", icon: Lock },
              ] as const).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                    visibility === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <input placeholder="YouTube music URL (optional)" value={musicUrl} onChange={(e) => { setMusicUrl(e.target.value); setMusicTitle(""); }} className="w-full rounded-xl bg-secondary p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          {musicUrl && (
            <MusicTrimmer start={musicStart} end={musicEnd} onChange={(a, b) => { setMusicStart(a); setMusicEnd(b); }} />
          )}
          {library.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Background song library:</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {library.map((m: any) => {
                  const active = musicUrl === m.youtube_url;
                  return (
                    <button key={m.id} onClick={() => { setMusicUrl(m.youtube_url); setMusicTitle(m.title || ""); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border"}`}>
                      ♪ {m.title || "Untitled"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black" style={{ minHeight: "100dvh" }}>
      <div className="relative mx-auto max-w-lg">
        {/* Floating Insta-style header overlaid on the video */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/60 to-transparent">
          <h1 className="text-xl font-bold text-white drop-shadow pointer-events-auto">Reels</h1>
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="relative">
              <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="flex items-center gap-1 text-white text-xs font-semibold rounded-full bg-white/15 backdrop-blur px-2 py-1">
                <Gauge className="h-4 w-4" /> {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 top-9 z-50 rounded-lg bg-popover border border-border shadow-lg py-1 min-w-[80px]">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <button key={s} onClick={() => { setSpeed(s); setShowSpeedMenu(false); }} className={`block w-full px-3 py-1.5 text-left text-xs ${speed === s ? "text-primary font-bold" : "text-foreground"}`}>{s}x</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setMuted(!muted)} className="text-white">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="text-white"
              aria-label="New reel"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div
          className="snap-y snap-mandatory overflow-y-scroll touch-pan-y overscroll-contain"
          style={{ height: "100dvh", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {allReels.map((reel) => (
            <ReelItem
              key={reel.id}
              id={reel.id}
              userId={reel.userId}
              username={reel.username}
              avatar={reel.avatar}
              video={reel.video}
              caption={reel.caption}
              music={reel.music}
              musicUrl={reel.musicUrl}
              musicStart={(reel as any).musicStart}
              musicEnd={(reel as any).musicEnd}
              lyrics={(reel as any).lyrics}
              speed={speed}
              globalMuted={muted}
              onShare={() => handleShare(reel)}
              onRemix={() => handleRemix(reel)}
              onDeleted={() => refetch()}
            />
          ))}
        </div>
      </div>

      {shareReel && (
        <ShareSheet
          shareUrl={`${window.location.origin}/?reel=${shareReel.id}`}
          shareLabel={`🎬 Reel by @${shareReel.username}`}
          onClose={() => setShareReel(null)}
        />
      )}
    </div>
  );
};

export default Reels;
