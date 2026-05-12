import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Trash2, Plus, Loader2, Scissors, Send, Image as ImageIcon, Film, Zap, ListVideo, LayoutGrid, List, ArrowDownUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MusicTrimmer } from "@/components/MusicTrimmer";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function getPlaylistId(url: string): string | null {
  // Matches ?list=… or &list=… or playlist?list=…
  const m = url.match(/[?&]list=([\w-]+)/);
  return m ? m[1] : null;
}
function thumbFor(url: string): string | null {
  const id = getYouTubeId(url);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return null;
}

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type FilterMode = "all" | "videos" | "playlists";

const YouTube = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // form
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(60);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  // share-from-library state
  const [shareItem, setShareItem] = useState<any | null>(null);
  const [shareCaption, setShareCaption] = useState("");
  const [shareTarget, setShareTarget] = useState<"reel" | "post" | "short">("reel");
  const [posting, setPosting] = useState(false);

  // view adjustments
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  // viewer (for in-app playback / playlist viewing)
  const [viewer, setViewer] = useState<any | null>(null);

  const detectedPlaylistId = getPlaylistId(url.trim());
  const detectedVideoId = getYouTubeId(url.trim());
  const isPlaylistUrl = !!detectedPlaylistId && !detectedVideoId;

  const { data: items = [] } = useQuery({
    queryKey: ["youtube-library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("youtube_library")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const visibleItems = useMemo(() => {
    let list = [...items];
    if (filterMode === "videos") list = list.filter((i: any) => !i.is_playlist);
    if (filterMode === "playlists") list = list.filter((i: any) => i.is_playlist);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i: any) => (i.title || "").toLowerCase().includes(q) || (i.url || "").toLowerCase().includes(q));
    }
    if (sortMode === "newest") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortMode === "oldest") list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortMode === "title") list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return list;
  }, [items, filterMode, sortMode, search]);

  const handleSave = async () => {
    if (!user) return;
    const trimmed = url.trim();
    const videoId = getYouTubeId(trimmed);
    const playlistId = getPlaylistId(trimmed);

    if (!videoId && !playlistId) {
      toast.error("Paste a valid YouTube video, Shorts, or playlist URL");
      return;
    }
    setSaving(true);
    const isPlaylist = !videoId && !!playlistId;
    const payload: any = {
      user_id: user.id,
      url: trimmed,
      title: title.trim() || (isPlaylist ? "Saved playlist" : "Saved video"),
      thumbnail_url: thumbFor(trimmed),
      trim_start: trimStart,
      trim_end: trimEnd,
      is_playlist: isPlaylist,
      playlist_id: playlistId,
    };
    const { error } = await supabase.from("youtube_library").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isPlaylist ? "Playlist saved" : "Saved to your library");
    setUrl(""); setTitle(""); setTrimStart(0); setTrimEnd(60); setPreviewUrl("");
    qc.invalidateQueries({ queryKey: ["youtube-library", user.id] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove from library?")) return;
    const { error } = await supabase.from("youtube_library").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["youtube-library", user?.id] });
  };

  const handleShare = async () => {
    if (!user || !shareItem) return;
    if (shareItem.is_playlist) { toast.error("Playlists can't be shared as a Post/Reel"); return; }
    setPosting(true);
    try {
      if (shareTarget === "reel" || shareTarget === "short") {
        let videoUrl = shareItem.url as string;
        if (shareTarget === "short") {
          const id = getYouTubeId(videoUrl);
          if (id) videoUrl = `https://youtube.com/shorts/${id}`;
        }
        const { error } = await supabase.from("reels").insert({
          user_id: user.id,
          video_url: videoUrl,
          caption: shareCaption,
          music_url: shareItem.url,
          music_title: shareItem.title,
          music_start: shareItem.trim_start || 0,
          music_end: shareItem.trim_end || 60,
        } as any);
        if (error) throw error;
        toast.success(shareTarget === "short" ? "Posted to Shorts!" : "Posted to Reels!");
      } else {
        const image = shareItem.thumbnail_url || `https://i.ytimg.com/vi/${getYouTubeId(shareItem.url)}/hqdefault.jpg`;
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          image_url: image,
          caption: shareCaption || shareItem.title,
          music_url: shareItem.url,
          music_title: shareItem.title,
          music_start: shareItem.trim_start || 0,
          music_end: shareItem.trim_end || 60,
        } as any);
        if (error) throw error;
        toast.success("Posted to Home!");
      }
      const dest = shareTarget === "short" ? "/shorts" : shareTarget === "reel" ? "/reels" : "/";
      setShareItem(null); setShareCaption("");
      navigate(dest);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setPosting(false); }
  };

  const livePreviewVideoId = getYouTubeId(previewUrl || url);
  const livePreviewPlaylistId = getPlaylistId(previewUrl || url);

  const viewerEmbed = (it: any) => {
    if (it.is_playlist && it.playlist_id) {
      return `https://www.youtube.com/embed/videoseries?list=${it.playlist_id}`;
    }
    const id = getYouTubeId(it.url);
    if (!id) return "";
    return `https://www.youtube.com/embed/${id}?start=${it.trim_start || 0}${it.trim_end > (it.trim_start || 0) ? `&end=${it.trim_end}` : ""}&autoplay=1`;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">YouTube Library</h1>
      </header>

      <div className="mx-auto max-w-lg p-4 space-y-6">
        {/* Add form */}
        <section className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4 text-primary" /> Save a video, Short, or playlist
          </div>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setPreviewUrl(e.target.value); }}
            placeholder="Paste YouTube video, Shorts, or playlist URL"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          {isPlaylistUrl && (
            <p className="inline-flex items-center gap-1 text-[11px] text-primary"><ListVideo className="h-3 w-3" /> Playlist detected</p>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          {(livePreviewVideoId || livePreviewPlaylistId) && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={
                  livePreviewVideoId
                    ? `https://www.youtube.com/embed/${livePreviewVideoId}?start=${trimStart}${trimEnd > trimStart ? `&end=${trimEnd}` : ""}`
                    : `https://www.youtube.com/embed/videoseries?list=${livePreviewPlaylistId}`
                }
                className="h-full w-full"
                allow="autoplay; encrypted-media"
                title="preview"
              />
            </div>
          )}
          {!isPlaylistUrl && (
            <MusicTrimmer start={trimStart} end={trimEnd} onChange={(a, b) => { setTrimStart(a); setTrimEnd(b); }} max={600} />
          )}
          <button
            onClick={handleSave}
            disabled={saving || !url.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isPlaylistUrl ? "Save playlist" : "Save to library"}
          </button>
        </section>

        {/* View adjustments */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search library…"
                className="w-full rounded-lg border border-border bg-secondary pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
              className="rounded-lg border border-border bg-secondary p-2 text-foreground"
              aria-label="Toggle view"
            >
              {viewMode === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "videos", "playlists"] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  filterMode === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"
                }`}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-foreground">
              <ArrowDownUp className="h-3 w-3 text-muted-foreground" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-[11px] font-semibold outline-none"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">Title A→Z</option>
              </select>
            </div>
          </div>
        </section>

        {/* Library */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Your library ({visibleItems.length}/{items.length})
          </h2>
          {visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Play className="h-12 w-12 mb-2" strokeWidth={1} />
              <p className="text-sm">Nothing here yet. Paste a YouTube URL above.</p>
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-2">
              {visibleItems.map((it: any) => (
                <div key={it.id} className="overflow-hidden rounded-xl border border-border bg-secondary/40">
                  <button onClick={() => setViewer(it)} className="relative block aspect-video w-full bg-black">
                    {it.thumbnail_url ? (
                      <img src={it.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        {it.is_playlist ? <ListVideo className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      {it.is_playlist ? <ListVideo className="h-7 w-7 text-white" /> : <Play className="h-7 w-7 text-white fill-white" />}
                    </div>
                    {it.is_playlist && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">PLAYLIST</span>
                    )}
                  </button>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-foreground line-clamp-2">{it.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {!it.is_playlist && (
                        <button onClick={() => { setShareItem(it); setShareTarget("reel"); }} className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          <Film className="h-2.5 w-2.5" /> Reel
                        </button>
                      )}
                      {!it.is_playlist && (
                        <button onClick={() => { setShareItem(it); setShareTarget("post"); }} className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          <ImageIcon className="h-2.5 w-2.5" /> Post
                        </button>
                      )}
                      <button onClick={() => handleDelete(it.id)} className="ml-auto text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            visibleItems.map((it: any) => (
              <div key={it.id} className="overflow-hidden rounded-xl border border-border bg-secondary/40">
                <div className="flex gap-3 p-3">
                  <button onClick={() => setViewer(it)} className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black">
                    {it.thumbnail_url ? (
                      <img src={it.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        {it.is_playlist ? <ListVideo className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      {it.is_playlist ? <ListVideo className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white fill-white" />}
                    </div>
                    {it.is_playlist && (
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">PLAYLIST</span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{it.title}</p>
                    {!it.is_playlist ? (
                      <p className="mt-1 text-[10px] text-muted-foreground inline-flex items-center gap-1">
                        <Scissors className="h-3 w-3" />
                        {it.trim_start}s → {it.trim_end}s
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-muted-foreground inline-flex items-center gap-1">
                        <ListVideo className="h-3 w-3" />
                        Playlist
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {!it.is_playlist && (
                        <>
                          <button onClick={() => { setShareItem(it); setShareTarget("reel"); }}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                            <Film className="h-3 w-3" /> Reel
                          </button>
                          <button onClick={() => { setShareItem(it); setShareTarget("short"); }}
                            className="inline-flex items-center gap-1 rounded-full bg-accent border border-border px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                            <Zap className="h-3 w-3" /> Shorts
                          </button>
                          <button onClick={() => { setShareItem(it); setShareTarget("post"); }}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            <ImageIcon className="h-3 w-3" /> Post
                          </button>
                        </>
                      )}
                      <button onClick={() => setViewer(it)} className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                        <Play className="h-3 w-3" /> View
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="ml-auto text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Viewer modal — adjustable view of saved item */}
      {viewer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setViewer(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-background p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground line-clamp-1">{viewer.title}</p>
              <button onClick={() => setViewer(null)} className="text-xs text-muted-foreground">Close</button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={viewerEmbed(viewer)}
                className="h-full w-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="viewer"
              />
            </div>
            {viewer.is_playlist && (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <ListVideo className="h-3 w-3" /> Playing as playlist
              </p>
            )}
          </div>
        </div>
      )}

      {/* Share sheet */}
      {shareItem && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70" onClick={() => setShareItem(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-background p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-foreground">Share to {shareTarget === "reel" ? "Reels" : shareTarget === "short" ? "Shorts" : "Home Feed"}</p>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(shareItem.url)}?start=${shareItem.trim_start}${shareItem.trim_end > shareItem.trim_start ? `&end=${shareItem.trim_end}` : ""}`}
                className="h-full w-full"
                allow="autoplay; encrypted-media"
                title="share preview"
              />
            </div>
            <textarea value={shareCaption} onChange={(e) => setShareCaption(e.target.value)} rows={2} placeholder="Add a caption…"
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            <div className="flex gap-2">
              <button onClick={() => setShareItem(null)} className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-foreground">Cancel</button>
              <button onClick={handleShare} disabled={posting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTube;
