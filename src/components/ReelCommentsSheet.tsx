import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { toast } from "sonner";

interface ReelComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { username: string; avatar_url: string | null };
}

interface Props {
  reelId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const localCommentsKey = (reelId: string) => `wargram-local-comments:reel:${reelId}`;
const readLocalComments = (reelId: string): ReelComment[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localCommentsKey(reelId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveLocalComment = (reelId: string, comment: ReelComment) => {
  const next = [...readLocalComments(reelId).filter((c) => c.id !== comment.id), comment];
  localStorage.setItem(localCommentsKey(reelId), JSON.stringify(next.slice(-100)));
};

export function ReelCommentsSheet({ reelId, onClose, onCommentAdded }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("reel_comments")
      .select("*")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true });
    if (!data) { setLoading(false); return; }
    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("user_id, username, avatar_url").in("user_id", userIds);
    const remote = data.map((c) => ({ ...c, profile: profiles?.find((p) => p.user_id === c.user_id) as any }));
    setComments([...remote, ...readLocalComments(reelId)].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [reelId]);

  // Realtime new comments
  useEffect(() => {
    const channel = supabase
      .channel(`reel-comments-${reelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reel_comments", filter: `reel_id=eq.${reelId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [reelId]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const localComment: ReelComment = {
      id: `local-${Date.now()}`,
      content: text.trim(),
      created_at: new Date().toISOString(),
      user_id: user.id,
      profile: {
        username: user.displayName || user.email?.split("@")[0] || "user",
        avatar_url: user.photoURL || null,
      },
    };
    if (!isUuid(user.id)) {
      saveLocalComment(reelId, localComment);
      setComments((prev) => [...prev, localComment]);
      setText("");
      onCommentAdded?.();
      setSending(false);
      return;
    }
    const { error } = await supabase.from("reel_comments").insert({ reel_id: reelId, user_id: user.id, content: text.trim() } as any);
    if (!error) { setText(""); onCommentAdded?.(); load(); }
    else {
      saveLocalComment(reelId, localComment);
      setComments((prev) => [...prev, localComment]);
      setText("");
      onCommentAdded?.();
      toast.info("Comment saved here. Database permission is blocked.");
    }
    setSending(false);
  };

  const ago = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                <img src={profileAvatar(c.profile?.avatar_url, c.user_id, c.profile?.username)} alt="" className="h-8 w-8 rounded-full object-cover mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-foreground"><span className="font-semibold">{c.profile?.username || "user"}</span> {c.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ago(c.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-3 flex items-center gap-3">
          <input
            type="text" placeholder="Add a comment..." value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={send} disabled={!text.trim() || sending} className="text-primary disabled:opacity-30">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
