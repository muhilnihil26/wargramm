import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, Music, MoreHorizontal, Play, Repeat2, Trash2, Pencil } from "lucide-react";
import { YouTubeAudio } from "./YouTubeAudio";
import { LyricsOverlay, type LyricLine } from "./LyricsOverlay";
import { FollowButton } from "./FollowButton";
import { ReelCommentsSheet } from "./ReelCommentsSheet";
import { EditPostModal } from "./EditPostModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isUuid } from "@/lib/ids";

function getYouTubeId(u: string): string | null {
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

interface ReelItemProps {
  id: string;
  userId?: string;
  username: string;
  avatar: string;
  video: string;
  caption: string;
  music: string;
  musicUrl?: string | null;
  musicStart?: number | null;
  musicEnd?: number | null;
  speed: number;
  globalMuted: boolean;
  lyrics?: LyricLine[] | null;
  onShare: () => void;
  onRemix: () => void;
  onDeleted?: () => void;
}

export function ReelItem({
  id, userId, username, avatar, video, caption, music, musicUrl, musicStart, musicEnd,
  speed, globalMuted, lyrics, onShare, onRemix, onDeleted,
}: ReelItemProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saved, setSaved] = useState(false);
  const localLikeKey = user ? `wargram-local-like:reel:${user.id}:${id}` : "";
  const localSaveKey = user ? `wargram-local-save:reel:${user.id}:${id}` : "";
  const [localLiked, setLocalLiked] = useState(!!localLikeKey && localStorage.getItem(localLikeKey) === "true");
  const [localLikeOffset, setLocalLikeOffset] = useState(localLiked ? 1 : 0);
  const [localSaved, setLocalSaved] = useState(!!localSaveKey && localStorage.getItem(localSaveKey) === "true");
  const isImage = video.includes("unsplash") || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(video);
  const youTubeId = getYouTubeId(video);
  const isYouTube = !!youTubeId;
  const isMock = id.startsWith("mock-");

  // Likes (real-time-ish via fast invalidation)
  const { data: likeInfo } = useQuery({
    queryKey: ["reel-likes", id, user?.id],
    enabled: !isMock,
    staleTime: 10_000,
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("reel_likes").select("*", { count: "exact", head: true }).eq("reel_id", id),
        user
          ? supabase.from("reel_likes").select("id").eq("reel_id", id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count || 0, liked: !!mine?.data };
    },
  });

  const { data: commentCount = 0 } = useQuery({
    queryKey: ["reel-comments-count", id],
    enabled: !isMock,
    staleTime: 10_000,
    queryFn: async () => {
      const { count } = await supabase.from("reel_comments").select("*", { count: "exact", head: true }).eq("reel_id", id);
      return count || 0;
    },
  });

  const toggleLike = async () => {
    if (!user || isMock) {
      const next = !localLiked;
      setLocalLiked(next);
      if (localLikeKey) localStorage.setItem(localLikeKey, String(next));
      setLocalLikeOffset((n) => n + (next ? 1 : -1));
      return;
    }
    if (!isUuid(user.id)) {
      const next = !localLiked;
      setLocalLiked(next);
      if (localLikeKey) localStorage.setItem(localLikeKey, String(next));
      setLocalLikeOffset((n) => n + (next ? 1 : -1));
      return;
    }
    if (likeInfo?.liked || localLiked) {
      setLocalLiked(false);
      if (localLikeKey) localStorage.setItem(localLikeKey, "false");
      setLocalLikeOffset((n) => n - 1);
      const { error } = await supabase.from("reel_likes").delete().eq("reel_id", id).eq("user_id", user.id);
      if (error) toast.info("Like saved on this device.");
    } else {
      setLocalLiked(true);
      if (localLikeKey) localStorage.setItem(localLikeKey, "true");
      setLocalLikeOffset((n) => n + 1);
      const { error } = await supabase.from("reel_likes").insert({ reel_id: id, user_id: user.id } as any);
      if (error) toast.info("Like saved on this device.");
    }
    queryClient.invalidateQueries({ queryKey: ["reel-likes", id, user.id] });
  };

  const handleDelete = async () => {
    if (!user || userId !== user.id) return;
    if (!confirm("Delete this reel?")) return;
    const { error } = await supabase.from("reels").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reel deleted");
    setShowMore(false);
    queryClient.invalidateQueries({ queryKey: ["reels"] });
    queryClient.invalidateQueries({ queryKey: ["feed-reels"] });
    onDeleted?.();
  };

  const copyReelLink = async () => {
    const url = `${window.location.origin}/?reel=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.info(url);
    }
    setShowMore(false);
  };

  // IntersectionObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    if (isVisible && !paused) v.play().catch(() => {}); else v.pause();
  }, [isVisible, paused, speed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = globalMuted || !!musicUrl;
  }, [globalMuted, musicUrl]);

  const likes = Math.max(0, (likeInfo?.count ?? 0) + localLikeOffset);
  const liked = localLiked || (likeInfo?.liked ?? false);

  return (
    <div ref={containerRef} className="relative snap-start bg-black w-full" style={{ height: "100dvh", scrollSnapAlign: "start" }}>
      {isYouTube ? (
        <div className="absolute inset-0 bg-black">
          {isVisible ? (
            <iframe
              src={`https://www.youtube.com/embed/${youTubeId}?autoplay=1&mute=${globalMuted ? 1 : 0}&loop=1&playlist=${youTubeId}&controls=1&playsinline=1&modestbranding=1&rel=0`}
              title="YouTube"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <img src={`https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-70" />
          )}
        </div>
      ) : isImage ? (
        <img src={video} alt="" className="h-full w-full object-cover" />
      ) : (
        <video ref={videoRef} src={video} className="h-full w-full object-cover" loop playsInline onClick={() => setPaused((p) => !p)} />
      )}

      {paused && !isImage && !isYouTube && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="h-16 w-16 text-white/80 fill-white/80" />
        </div>
      )}

      {!isYouTube && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />}

      {isVisible && musicUrl && !isYouTube && !/youtu\.?be/i.test(musicUrl || "") && (
        <div className="absolute top-2 left-2 right-2 z-10 rounded-lg bg-black/40 backdrop-blur-md px-2 py-1.5 max-w-[70%]">
          <YouTubeAudio url={musicUrl} title={music} compact start={musicStart || 0} end={musicEnd || undefined} />
        </div>
      )}

      {isVisible && lyrics && lyrics.length > 0 && (
        <div className="absolute left-0 right-0 bottom-44 z-10 flex justify-center px-4">
          <LyricsOverlay lyrics={lyrics} startOffset={musicStart || 0} autoStart />
        </div>
      )}

      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-5">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} strokeWidth={1.5} />
          <span className="text-xs text-white">{likes.toLocaleString()}</span>
        </button>
        <button onClick={() => !isMock && setShowComments(true)} className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white" strokeWidth={1.5} />
          <span className="text-xs text-white">{commentCount}</span>
        </button>
        <button onClick={onShare} className="flex flex-col items-center gap-1">
          <Send className="h-7 w-7 text-white" strokeWidth={1.5} />
          <span className="text-xs text-white">Share</span>
        </button>
        <button onClick={onRemix} className="flex flex-col items-center gap-1">
          <Repeat2 className="h-7 w-7 text-white" strokeWidth={1.5} />
          <span className="text-xs text-white">Remix</span>
        </button>
        <button onClick={() => { const next = !localSaved; setLocalSaved(next); if (localSaveKey) localStorage.setItem(localSaveKey, String(next)); setSaved(next); toast.success(next ? "Saved" : "Unsaved"); }}>
          <Bookmark className={`h-7 w-7 ${localSaved || saved ? "fill-white text-white" : "text-white"}`} strokeWidth={1.5} />
        </button>
        <button onClick={() => setShowMore(true)}>
          <MoreHorizontal className="h-7 w-7 text-white" strokeWidth={1.5} />
        </button>
      </div>

      <div className="absolute bottom-20 left-4 right-16">
        <div className="flex items-center gap-3 mb-2">
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          <span className="text-sm font-semibold text-white">{username}</span>
          {userId && userId !== user?.id && <FollowButton targetUserId={userId} variant="outline-white" />}
        </div>
        <p className="text-sm text-white/90">{caption}</p>
        {!musicUrl && (
          <div className="mt-2 flex items-center gap-2">
            <Music className="h-3 w-3 text-white" />
            <span className="text-xs text-white/80">{music}</span>
          </div>
        )}
      </div>

      {showComments && !isMock && (
        <ReelCommentsSheet
          reelId={id}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => queryClient.invalidateQueries({ queryKey: ["reel-comments-count", id] })}
        />
      )}

      {showMore && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={() => setShowMore(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-background py-2" onClick={(e) => e.stopPropagation()}>
            {user && userId === user.id && !isMock && (
              <>
                <button onClick={() => { setShowMore(false); setShowEdit(true); }} className="flex items-center gap-3 w-full px-5 py-3 text-left text-foreground">
                  <Pencil className="h-5 w-5" /> Edit reel
                </button>
                <button onClick={handleDelete} className="flex items-center gap-3 w-full px-5 py-3 text-left text-destructive">
                  <Trash2 className="h-5 w-5" /> Delete reel
                </button>
              </>
            )}
            <button onClick={copyReelLink} className="flex items-center gap-3 w-full px-5 py-3 text-left text-foreground">
              <Send className="h-5 w-5" /> Copy link
            </button>
            <button onClick={() => { toast.info("Reported. Thanks for the feedback."); setShowMore(false); }} className="flex items-center gap-3 w-full px-5 py-3 text-left text-foreground">
              <MoreHorizontal className="h-5 w-5" /> Report
            </button>
            <button onClick={() => setShowMore(false)} className="w-full px-5 py-3 text-center text-muted-foreground border-t border-border mt-1">Cancel</button>
          </div>
        </div>
      )}

      {showEdit && !isMock && (
        <EditPostModal
          table="reels"
          id={id}
          initial={{
            caption,
            music_url: musicUrl ?? null,
            music_title: music && music !== "Original Audio" ? music : null,
            music_start: musicStart ?? 0,
            music_end: musicEnd ?? 30,
          }}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["reels"] });
            queryClient.invalidateQueries({ queryKey: ["feed-reels"] });
            onDeleted?.();
          }}
        />
      )}
    </div>
  );
}
