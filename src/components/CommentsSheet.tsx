import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { toast } from "sonner";
import { logCloudAction } from "@/lib/cloudActions";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { username: string; avatar_url: string | null };
}

interface CommentsSheetProps {
  postId: string;
  postUserId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const localCommentsKey = (postId: string) => `wargram-local-comments:post:${postId}`;
const readLocalComments = (postId: string): Comment[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localCommentsKey(postId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveLocalComment = (postId: string, comment: Comment) => {
  const next = [...readLocalComments(postId).filter((c) => c.id !== comment.id), comment];
  localStorage.setItem(localCommentsKey(postId), JSON.stringify(next.slice(-100)));
};

export function CommentsSheet({ postId, postUserId, onClose, onCommentAdded }: CommentsSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", userIds);

    const remote = data.map((c) => ({
        ...c,
        profile: profiles?.find((p) => p.user_id === c.user_id) as any,
      }));
    setComments([...remote, ...readLocalComments(postId)].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setLoading(false);
  };

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    const localComment: Comment = {
      id: `local-${Date.now()}`,
      content: newComment.trim(),
      created_at: new Date().toISOString(),
      user_id: user.id,
      profile: {
        username: user.displayName || user.email?.split("@")[0] || "user",
        avatar_url: user.photoURL || null,
      },
    };
    if (!isUuid(user.id)) {
      saveLocalComment(postId, localComment);
      setComments((prev) => [...prev, localComment]);
      setNewComment("");
      onCommentAdded?.();
      await logCloudAction(user, "post_comment", { post_id: postId, local_fallback: true }).catch(() => {});
      setSending(false);
      return;
    }
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: newComment.trim(),
    });
    if (!error) {
      // Create notification for post owner
      if (postUserId !== user.id && isUuid(postUserId)) {
        await supabase.from("notifications").insert({
          user_id: postUserId,
          actor_id: user.id,
          type: "comment",
          post_id: postId,
        });
      }
      setNewComment("");
      onCommentAdded?.();
      await logCloudAction(user, "post_comment", { post_id: postId, owner_id: postUserId }).catch(() => {});
      loadComments();
    } else {
      saveLocalComment(postId, localComment);
      setComments((prev) => [...prev, localComment]);
      setNewComment("");
      onCommentAdded?.();
      await logCloudAction(user, "post_comment", { post_id: postId, owner_id: postUserId, local_fallback: true }).catch(() => {});
      toast.info("Comment saved here. Database permission is blocked.");
    }
    setSending(false);
  };

  const getTimeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl bg-background max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div />
          <h3 className="text-sm font-bold text-foreground">Comments</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <img
                  src={profileAvatar(c.profile?.avatar_url, c.user_id, c.profile?.username)}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{c.profile?.username || "user"}</span>{" "}
                    {c.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{getTimeAgo(c.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={handleSend} disabled={!newComment.trim() || sending} className="text-primary disabled:opacity-30">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
