import { useEffect, useState, useRef } from "react";
import { Camera, Image as ImageIcon, X, Loader2, Music, Video, Globe, Users, Lock, Sparkles, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MusicTrimmer } from "@/components/MusicTrimmer";
import { rewardForPost } from "@/lib/coins";
import { CameraCapture } from "@/components/CameraCapture";
import { MediaEditor } from "@/components/MediaEditor";
import { mediaOwnerPayload } from "@/lib/firebaseMedia";
import { isUuid } from "@/lib/ids";
import { readLocalProfile } from "@/lib/localProfile";
import { getPlaylistId, getYouTubeId, normalizeYouTubeUrl, youtubeEmbedUrl } from "@/lib/youtube";
import { logCloudAction } from "@/lib/cloudActions";

type Visibility = "public" | "followers" | "only_me";

const Create = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [musicStart, setMusicStart] = useState(0);
  const [musicEnd, setMusicEnd] = useState(30);
  const [youtubePostUrl, setYoutubePostUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["create-profile-privacy", user?.id],
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

  // Music library (added by admin)
  const { data: library = [] } = useQuery({
    queryKey: ["music-library"],
    queryFn: async () => {
      const { data } = await supabase.from("music").select("id, title, youtube_url").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
  };

  const reset = () => {
    setPreview(null); setSelectedFile(null); setCaption("");
    setMusicUrl(""); setMusicTitle(""); setMusicStart(0); setMusicEnd(30); setIsVideo(false); setYoutubePostUrl("");
  };

  const saveToYouTubeLibrary = async (inputUrl: string) => {
    if (!user) return;
    const normalized = normalizeYouTubeUrl(inputUrl);
    const videoId = getYouTubeId(normalized);
    const playlistId = getPlaylistId(normalized);
    const table = isUuid(user.id) ? "youtube_library" : "youtube_library_client";
    const payload: any = {
      url: normalized,
      title: videoId ? `YouTube - ${videoId}` : playlistId ? `Playlist ${playlistId}` : "Saved YouTube",
      thumbnail_url: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
      trim_start: 0,
      trim_end: 60,
      is_playlist: !videoId && !!playlistId,
      playlist_id: playlistId,
    };
    if (isUuid(user.id)) payload.user_id = user.id;
    else payload.firebase_uid = user.id;
    await supabase.from(table as any).insert(payload);
  };

  const handleYouTubePost = async () => {
    if (!user) return;
    const trimmed = youtubePostUrl.trim();
    if (!getYouTubeId(trimmed) && !getPlaylistId(trimmed)) {
      toast.error("Paste a valid YouTube video, Short, or playlist URL");
      return;
    }
    setUploading(true);
    const normalized = normalizeYouTubeUrl(trimmed);
    try {
      const { error } = await supabase.from("posts").insert({
        ...mediaOwnerPayload(user),
        image_url: normalized,
        is_video: true,
        caption,
        visibility,
        music_url: musicUrl || null,
        music_title: musicTitle || null,
        music_start: musicUrl ? musicStart : 0,
        music_end: musicUrl ? musicEnd : 30,
      } as any);
      if (error) throw error;
      await saveToYouTubeLibrary(normalized).catch(() => {});
      await rewardForPost(user.id);
      await logCloudAction(user, "post_create", { source: "youtube", visibility }).catch(() => {});
      toast.success("YouTube post shared!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Could not share YouTube post");
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      if (isVideo) {
        // Video post → upload to posts bucket and store as a Post (is_video=true) so it lives on the home feed
        const { error: upErr } = await supabase.storage.from("posts").upload(filePath, selectedFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);

        let title = musicTitle;
        if (musicUrl && !title) {
          try {
            const { data } = await supabase.functions.invoke("detect-music-title", { body: { url: musicUrl } });
            title = data?.title || "";
          } catch {}
        }
        const { error: insErr } = await supabase.from("posts").insert({
          ...mediaOwnerPayload(user),
          image_url: publicUrl,
          is_video: true,
          caption,
          visibility,
          music_url: musicUrl || null,
          music_title: title || null,
          music_start: musicUrl ? musicStart : 0,
          music_end: musicUrl ? musicEnd : 30,
        } as any);
        if (insErr) throw insErr;
        await rewardForPost(user.id);
        await logCloudAction(user, "post_create", { source: "file_video", visibility }).catch(() => {});
        toast.success("Video posted!");
      } else {
        // Image → posts bucket
        const { error: upErr } = await supabase.storage.from("posts").upload(filePath, selectedFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);

        let title = musicTitle;
        if (musicUrl && !title) {
          try {
            const { data } = await supabase.functions.invoke("detect-music-title", { body: { url: musicUrl } });
            title = data?.title || "";
          } catch {}
        }
        const { error: postError } = await supabase.from("posts").insert({
          ...mediaOwnerPayload(user),
          image_url: publicUrl,
          caption,
          visibility,
          music_url: musicUrl || null,
          music_title: title || null,
          music_start: musicUrl ? musicStart : 0,
          music_end: musicUrl ? musicEnd : 30,
        } as any);
        if (postError) throw postError;
        await rewardForPost(user.id);
        await logCloudAction(user, "post_create", { source: "file_image", visibility }).catch(() => {});
        toast.success("Post shared!");
      }
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!preview) {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background pb-16 px-4">
          <div className="mx-auto max-w-lg w-full text-center">
            <div className="mb-8">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground">
                <Camera className="h-10 w-10 text-foreground" strokeWidth={1} />
              </div>
              <h2 className="text-xl font-light text-foreground">Create New Post</h2>
              <p className="mt-1 text-xs text-muted-foreground">Photo or video — both go straight to Home</p>
            </div>
            <input type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary p-3 text-left">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <input
                    value={youtubePostUrl}
                    onChange={(e) => setYoutubePostUrl(e.target.value)}
                    placeholder="Paste YouTube video, Short, or playlist URL"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
                {youtubePostUrl.trim() && (getYouTubeId(youtubePostUrl) || getPlaylistId(youtubePostUrl)) && (
                  <div className="mt-3 overflow-hidden rounded-lg bg-black aspect-video">
                    <iframe src={youtubeEmbedUrl(youtubePostUrl)} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title="YouTube preview" />
                  </div>
                )}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  placeholder="Caption for YouTube post"
                  className="mt-3 w-full resize-none rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                <div className="mt-2 flex gap-2">
                  {(["public", "followers", "only_me"] as Visibility[]).map((v) => (
                    <button key={v} onClick={() => setVisibility(v)} className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${visibility === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>
                      {v === "public" ? "Everyone" : v === "followers" ? "Followers" : "Only me"}
                    </button>
                  ))}
                </div>
                <button onClick={handleYouTubePost} disabled={uploading || !youtubePostUrl.trim()} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  {uploading ? "Sharing..." : "Share YouTube as Post"}
                </button>
              </div>
              <button onClick={() => setShowCamera(true)} className="flex w-full items-center gap-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 p-4 text-left transition-colors hover:from-primary/30">
                <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.5} />
                <div>
                  <p className="font-semibold text-foreground">Open Camera with Filters</p>
                  <p className="text-sm text-muted-foreground">Snap photos or record reels with live filters</p>
                </div>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl bg-secondary p-4 text-left transition-colors hover:bg-secondary/80">
                <ImageIcon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                <div>
                  <p className="font-semibold text-foreground">Select Photo or Video</p>
                  <p className="text-sm text-muted-foreground">Choose media from your device</p>
                </div>
              </button>
            </div>
          </div>
        </div>
        {showCamera && (
          <CameraCapture
            onCapture={(file, isVid, url) => {
              setSelectedFile(file);
              setPreview(url);
              setIsVideo(isVid);
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={reset} className="text-foreground"><X className="h-6 w-6" /></button>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          {isVideo ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          {isVideo ? "New Video" : "New Post"}
        </h1>
        <button onClick={handlePost} disabled={uploading} className="text-sm font-bold text-primary disabled:opacity-50">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Share"}
        </button>
      </header>
      <div className="mx-auto max-w-lg">
        {isVideo ? (
          <video src={preview} className="w-full aspect-square object-cover bg-black" controls />
        ) : (
          <img src={preview} alt="Preview" className="w-full aspect-square object-cover" />
        )}
        <div className="px-4 pt-3">
          <button onClick={() => setShowEditor(true)} className="w-full rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 py-2.5 text-sm font-semibold text-foreground">
            ✨ Edit media (filters, crop, trim, text, stickers, draw)
          </button>
        </div>
        <div className="p-4 space-y-3">
          <textarea placeholder="Write a caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" rows={4} />

          {/* Audience selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Who can see this?</p>
            <div className="flex gap-2">
              {([
                { v: "public", label: "Everyone", icon: Globe },
                { v: "followers", label: "Followers only", icon: Users },
                { v: "only_me", label: "Only me", icon: Lock },
              ] as { v: Visibility; label: string; icon: typeof Globe }[]).map(({ v, label, icon: Icon }) => (
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
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <Music className="h-5 w-5 text-primary shrink-0" />
            <input placeholder="YouTube music URL (optional)" value={musicUrl} onChange={(e) => { setMusicUrl(e.target.value); setMusicTitle(""); }} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          {musicUrl && (
            <MusicTrimmer start={musicStart} end={musicEnd} onChange={(a, b) => { setMusicStart(a); setMusicEnd(b); }} />
          )}
          {library.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Or pick a background song from the library:</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {library.map((m: any) => {
                  const active = musicUrl === m.youtube_url;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setMusicUrl(m.youtube_url); setMusicTitle(m.title || ""); }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:bg-secondary/70"}`}
                    >
                      ♪ {m.title || "Untitled"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {showEditor && selectedFile && preview && (
        <MediaEditor
          file={selectedFile}
          isVideo={isVideo}
          onCancel={() => setShowEditor(false)}
          onDone={(r) => {
            setSelectedFile(r.file);
            setPreview(r.previewUrl);
            setShowEditor(false);
          }}
        />
      )}
    </div>
  );
};

export default Create;
