import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CommentsSheet } from "./CommentsSheet";
import { YouTubeAudio } from "./YouTubeAudio";
import { LyricsOverlay } from "./LyricsOverlay";
import { FollowButton } from "./FollowButton";
import { ShareSheet } from "./ShareSheet";
import { EditPostModal } from "./EditPostModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { isUuid } from "@/lib/ids";
import { getYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";
import { saveFirebaseLike, saveFirebasePostBookmark } from "@/lib/firebaseUserData";
import { logCloudAction } from "@/lib/cloudActions";

import { VerifiedBadge } from "./VerifiedBadge";

interface PostCardProps {
  id?: string;
  username: string;
  userId?: string;
  avatar: string;
  image: string;
  isVideo?: boolean;
  caption: string;
  likes: number;
  comments: number;
  timeAgo: string;
  isLiked?: boolean;
  musicUrl?: string | null;
  musicTitle?: string | null;
  musicStart?: number | null;
  musicEnd?: number | null;
  verified?: boolean;
  lyrics?: { time: number; text: string }[] | null;
}

export function PostCard({ id, username, userId, avatar, image, isVideo, caption, likes, comments, timeAgo, isLiked: initialLiked, musicUrl, musicTitle, musicStart, musicEnd, verified, lyrics }: PostCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const localLikeKey = id && user ? `wargram-local-like:post:${user.id}:${id}` : "";
  const localSaveKey = id && user ? `wargram-local-save:post:${user.id}:${id}` : "";
  const [liked, setLiked] = useState(initialLiked || (!!localLikeKey && localStorage.getItem(localLikeKey) === "true"));
  const [saved, setSaved] = useState(!!localSaveKey && localStorage.getItem(localSaveKey) === "true");
  const [showMore, setShowMore] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const isOwner = !!user && !!userId && user.id === userId && !!id;
  const isSupabasePost = !!id && isUuid(id);

  const toggleSave = async () => {
    if (!user || !id) return;
    if (!isUuid(user.id) || !isSupabasePost) {
      const next = !saved;
      setSaved(next);
      if (localSaveKey) localStorage.setItem(localSaveKey, String(next));
      await saveFirebasePostBookmark(user.id, id, next).catch(() => {
        toast.info("Saved here. Firebase sync permission is blocked.");
      });
      await logCloudAction(user, next ? "post_save" : "post_unsave", { post_id: id, owner_id: userId || null }).catch(() => {});
      return;
    }
    if (saved) {
      setSaved(false);
      await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", id);
      await logCloudAction(user, "post_unsave", { post_id: id, owner_id: userId || null }).catch(() => {});
    } else {
      setSaved(true);
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: id });
      await logCloudAction(user, "post_save", { post_id: id, owner_id: userId || null }).catch(() => {});
    }
  };
  const [likeCount, setLikeCount] = useState(likes);
  const [commentCount, setCommentCount] = useState(comments);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  const toggleLike = async (forceLike = false) => {
    if (!user || !id || !isUuid(user.id) || !isSupabasePost) {
      const next = forceLike || !liked;
      if (next === liked) return;
      setLiked(next);
      if (localLikeKey) localStorage.setItem(localLikeKey, String(next));
      setLikeCount((c) => (next ? c + 1 : c - 1));
      await saveFirebaseLike("post", id, user.id, next).catch(() => {});
      await logCloudAction(user, next ? "post_like" : "post_unlike", { post_id: id, owner_id: userId || null, local_fallback: true }).catch(() => {});
      return;
    }

    if (liked && !forceLike) {
      setLiked(false);
      if (localLikeKey) localStorage.setItem(localLikeKey, "false");
      setLikeCount((c) => c - 1);
      const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", id);
      if (error) toast.info("Like saved on this device.");
      await logCloudAction(user, "post_unlike", { post_id: id, owner_id: userId || null, local_fallback: !!error }).catch(() => {});
    } else if (!liked) {
      setLiked(true);
      if (localLikeKey) localStorage.setItem(localLikeKey, "true");
      setLikeCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ user_id: user.id, post_id: id });
      if (error) toast.info("Like saved on this device.");
      await logCloudAction(user, "post_like", { post_id: id, owner_id: userId || null, local_fallback: !!error }).catch(() => {});
      if (!error && userId && userId !== user.id && isUuid(userId)) {
        await supabase.from("notifications").insert({ user_id: userId, actor_id: user.id, type: "like", post_id: id });
      }
    }
  };

  const handleDoubleTap = () => {
    if (!liked) toggleLike(true);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const copyPostLink = async () => {
    const url = `${window.location.origin}/?post=${id || ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.info(url);
    }
    setShowMore(false);
  };

  return (
    <>
      <article className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => userId && navigate(`/user/${userId}`)}>
            <div className="rounded-full p-[2px] gradient-story">
              <div className="rounded-full border-2 border-background">
                <img src={avatar} alt={username} className="h-8 w-8 rounded-full object-cover" />
              </div>
            </div>
            <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1">{username}<VerifiedBadge verified={verified} size={12} /></span>
            {userId && <FollowButton targetUserId={userId} variant="compact" />}
          </div>
          <button onClick={() => setShowMore(true)} className="text-foreground"><MoreHorizontal className="h-5 w-5" /></button>
        </div>

        <div className="relative bg-black" onDoubleClick={handleDoubleTap}>
          {(() => {
            if (!image || mediaFailed) {
              return (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-black px-6 text-center text-white">
                  <p className="text-sm font-semibold">Media could not load</p>
                  <p className="text-xs text-white/70">This upload may be private, moved, or blocked by the video source.</p>
                </div>
              );
            }
            const ytId = getYouTubeId(image);
            if (ytId) {
              return (
                <div className="relative w-full aspect-video">
                  <iframe
                    src={youtubeEmbedUrl(image)}
                    title="YouTube video"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return isVideo ? (
              <video src={image} className="w-full max-h-[600px] object-contain" controls playsInline preload="metadata" onError={() => setMediaFailed(true)} />
            ) : (
              <img src={image} alt="Post" className="w-full aspect-square object-cover" onError={() => setMediaFailed(true)} />
            );
          })()}
          {showHeart && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="h-24 w-24 fill-white text-white drop-shadow-lg" />
            </motion.div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => toggleLike()} className="transition-transform active:scale-125">
              <Heart className={`h-6 w-6 ${liked ? "fill-red-500 text-red-500" : "text-foreground"}`} strokeWidth={1.5} />
            </button>
            <button onClick={() => setShowComments(true)} className="text-foreground">
              <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
            </button>
            <button onClick={() => setShowShare(true)} className="text-foreground" aria-label="Share">
              <Send className="h-6 w-6" strokeWidth={1.5} />
            </button>
          </div>
          <button onClick={toggleSave} className="transition-transform active:scale-125">
            <Bookmark className={`h-6 w-6 ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <p className="text-sm font-semibold text-foreground">{likeCount.toLocaleString()} likes</p>
          <p className="mt-1 text-sm text-foreground">
            <span className="font-semibold cursor-pointer" onClick={() => userId && navigate(`/user/${userId}`)}>{username}</span>{" "}
            <span className="text-foreground/90">{caption}</span>
          </p>
          {commentCount > 0 && (
            <button onClick={() => setShowComments(true)} className="mt-1 text-sm text-muted-foreground">
              View all {commentCount} comments
            </button>
          )}
          {musicUrl && !/youtu\.?be/i.test(image) && (
            <div className="mt-2">
              <YouTubeAudio url={musicUrl} title={musicTitle || "Original Audio"} autoPlay={false} start={musicStart || 0} end={musicEnd || undefined} />
            </div>
          )}
          {lyrics && lyrics.length > 0 && (
            <div className="mt-2 rounded-lg bg-secondary/40 p-3">
              <LyricsOverlay lyrics={lyrics} startOffset={musicStart || 0} autoStart />
            </div>
          )}
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">{timeAgo}</p>
        </div>
      </article>

      {showComments && id && (
        <CommentsSheet
          postId={id}
          postUserId={userId || ""}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}

      {showShare && (
        <ShareSheet
          shareUrl={`${window.location.origin}/?post=${id || ""}`}
          shareLabel={`📷 Post by @${username}`}
          onClose={() => setShowShare(false)}
        />
      )}

      {showMore && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={() => setShowMore(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-background py-2" onClick={(e) => e.stopPropagation()}>
            {isOwner && isSupabasePost && (
              <>
                <button onClick={() => { setShowMore(false); setShowEdit(true); }} className="flex items-center gap-3 w-full px-5 py-3 text-left text-foreground">
                  <Pencil className="h-5 w-5" /> Edit post
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this post?")) return;
                    const { error } = await supabase.from("posts").delete().eq("id", id!);
                    if (error) { toast.error(error.message); return; }
                    await logCloudAction(user, "post_delete", { post_id: id }).catch(() => {});
                    toast.success("Post deleted");
                    setShowMore(false);
                    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
                    queryClient.invalidateQueries({ queryKey: ["posts"] });
                  }}
                  className="flex items-center gap-3 w-full px-5 py-3 text-left text-destructive"
                >
                  <Trash2 className="h-5 w-5" /> Delete post
                </button>
              </>
            )}
            <button onClick={copyPostLink} className="flex items-center gap-3 w-full px-5 py-3 text-left text-foreground">
              <Send className="h-5 w-5" /> Copy link
            </button>
            <button onClick={() => setShowMore(false)} className="w-full px-5 py-3 text-center text-muted-foreground border-t border-border mt-1">Cancel</button>
          </div>
        </div>
      )}

      {showEdit && id && isSupabasePost && (
        <EditPostModal
          table="posts"
          id={id}
          initial={{
            caption,
            music_url: musicUrl ?? null,
            music_title: musicTitle ?? null,
            music_start: musicStart ?? 0,
            music_end: musicEnd ?? 30,
          }}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });
          }}
        />
      )}
    </>
  );
}
