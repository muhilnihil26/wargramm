import { useEffect, useState } from "react";
import { X, Search, Send, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { logCloudAction } from "@/lib/cloudActions";

interface ShareSheetProps {
  shareUrl: string;
  shareLabel: string; // e.g. "Post by @alex" — preview text
  onClose: () => void;
}

interface UserRow {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

const firebaseRoomId = (a: string, b: string) => `firebase-${[a, b].sort().join("-")}`;
const localChatKey = (roomId: string) => `wargram-local-chat:${roomId}`;
const localConversationsKey = (userId: string) => `wargram-local-conversations:${userId}`;

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed || fallback;
  } catch {
    return fallback;
  }
};

const saveLocalShare = (user: any, target: UserRow, content: string) => {
  const roomId = firebaseRoomId(user.id, target.user_id);
  const now = new Date().toISOString();
  const message = {
    id: `local-${Date.now()}`,
    sender_id: user.id,
    content,
    image_url: null,
    read: false,
    created_at: now,
  };
  const messages = readStored<any[]>(localChatKey(roomId), []).filter((m) => m.id !== message.id);
  localStorage.setItem(localChatKey(roomId), JSON.stringify([...messages, message].slice(-150)));

  const convo = {
    id: roomId,
    user1_id: user.id,
    user2_id: target.user_id,
    other_user: {
      user_id: target.user_id,
      username: target.username || "user",
      avatar_url: target.avatar_url || "",
      last_seen: null,
      is_verified: false,
    },
    last_message: content,
    last_message_read: true,
    last_message_sender: user.id,
    unread_count: 0,
    updated_at: now,
  };
  const convos = readStored<any[]>(localConversationsKey(user.id), []).filter((c) => c.id !== roomId);
  localStorage.setItem(localConversationsKey(user.id), JSON.stringify([convo, ...convos].slice(0, 50)));
};

/**
 * Modal that lists the user's followers + following and lets them DM the link.
 * Creates the conversation if one doesn't exist, then inserts a message.
 */
export function ShareSheet({ shareUrl, shareLabel, onClose }: ShareSheetProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (isUuid(user.id)) {
        const [{ data: followers }, { data: following }] = await Promise.all([
          supabase.from("follows").select("follower_id").eq("following_id", user.id),
          supabase.from("follows").select("following_id").eq("follower_id", user.id),
        ]);
        const ids = new Set<string>([
          ...(followers?.map((f: any) => f.follower_id) || []),
          ...(following?.map((f: any) => f.following_id) || []),
        ]);
        if (ids.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, avatar_url")
            .in("user_id", Array.from(ids));
          setUsers((profiles || []) as UserRow[]);
          setLoading(false);
          return;
        }
      }
      const fallbackQuery = supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .limit(50);
      const { data: profiles } = isUuid(user.id)
        ? await fallbackQuery.neq("user_id", user.id)
        : await fallbackQuery;
      setUsers((profiles || []) as UserRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSend = async (target: UserRow) => {
    if (!user) return;
    const content = `${shareLabel}\n${shareUrl}`;
    setSendingTo(target.user_id);
      if (!isUuid(user.id) || !isUuid(target.user_id)) {
        saveLocalShare(user, target, content);
        await logCloudAction(user, "share_send", { target_user_id: target.user_id, local_fallback: true }).catch(() => {});
        setSentTo((prev) => new Set(prev).add(target.user_id));
      setSendingTo(null);
      toast.success(`Sent to ${target.username || "user"}`);
      return;
    }
    try {
      // Find or create conversation (deterministic ordering by user id)
      const [u1, u2] = user.id < target.user_id ? [user.id, target.user_id] : [target.user_id, user.id];
      let convoId: string | undefined;
      const { data: existing } = await supabase
        .from("conversations").select("id")
        .eq("user1_id", u1).eq("user2_id", u2)
        .maybeSingle();
      if (existing) {
        convoId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from("conversations").insert({ user1_id: u1, user2_id: u2 }).select("id").single();
        if (error) throw error;
        convoId = created.id;
      }

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convoId!,
        sender_id: user.id,
        content,
      });
      if (msgErr) throw msgErr;

        setSentTo((prev) => new Set(prev).add(target.user_id));
        await logCloudAction(user, "share_send", { target_user_id: target.user_id }).catch(() => {});
        toast.success(`Sent to ${target.username || "user"}`);
      } catch (e: any) {
        saveLocalShare(user, target, content);
        await logCloudAction(user, "share_send", { target_user_id: target.user_id, local_fallback: true }).catch(() => {});
        setSentTo((prev) => new Set(prev).add(target.user_id));
      toast.success(`Sent to ${target.username || "user"}`);
    } finally {
      setSendingTo(null);
    }
  };

  const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        await logCloudAction(user, "share_copy", { share_url: shareUrl }).catch(() => {});
        toast.success("Link copied");
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({ title: shareLabel, text: shareLabel, url: shareUrl });
          return;
        } catch {}
      }
      toast.info(shareUrl);
    }
  };

  const filtered = users.filter((u) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-background border border-border max-h-[80vh] flex flex-col sm:rounded-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Share</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search followers"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {users.length === 0 ? "No users found" : "No matches"}
            </p>
          ) : (
            <ul>
              {filtered.map((u) => {
                const sent = sentTo.has(u.user_id);
                const sending = sendingTo === u.user_id;
                return (
                  <li key={u.user_id} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={profileAvatar(u.avatar_url, u.user_id, u.username)}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {u.username || "user"}
                      </span>
                    </div>
                    <button
                      onClick={() => !sent && handleSend(u)}
                      disabled={sent || sending}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        sent
                          ? "bg-secondary text-muted-foreground"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                        sent ? <><Check className="h-3.5 w-3.5" /> Sent</> :
                        <><Send className="h-3.5 w-3.5" /> Send</>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <button
            onClick={handleCopy}
            className="w-full rounded-lg bg-secondary py-2 text-sm font-semibold text-foreground hover:bg-secondary/80"
          >
            Copy / share link
          </button>
        </div>
      </div>
    </div>
  );
}
