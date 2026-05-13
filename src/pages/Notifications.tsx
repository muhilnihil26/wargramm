import { useState, useEffect } from "react";
import { Heart, MessageCircle, UserPlus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";

interface Notification {
  id: string;
  actor_id: string;
  type: string;
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor?: { username: string; avatar_url: string };
  post?: { image_url: string } | null;
}

interface FollowRequest {
  id: string;
  requester_id: string;
  status: string;
  created_at: string;
  requester?: { username: string; avatar_url: string };
}

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ["follow-requests-incoming", user?.id],
    enabled: !!user && isUuid(user.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("follow_requests")
        .select("*")
        .eq("target_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!data) return [];
      const ids = data.map((r: any) => r.requester_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
      return data.map((r: any) => ({ ...r, requester: profs?.find((p: any) => p.user_id === r.requester_id) })) as FollowRequest[];
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user || !isUuid(user.id)) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!data) return [];

      const actorIds = [...new Set(data.map((n) => n.actor_id))];
      const postIds = [...new Set(data.filter((n) => n.post_id).map((n) => n.post_id!))];

      const [{ data: profiles }, { data: posts }] = await Promise.all([
        supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", actorIds),
        postIds.length > 0
          ? supabase.from("posts").select("id, image_url").in("id", postIds)
          : Promise.resolve({ data: [] }),
      ]);

      return data.map((n) => ({
        ...n,
        actor: profiles?.find((p) => p.user_id === n.actor_id),
        post: posts?.find((p) => p.id === n.post_id),
      })) as Notification[];
    },
    enabled: !!user && isUuid(user.id),
  });

  useEffect(() => {
    if (!user || !isUuid(user.id) || notifications.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      supabase.from("notifications").update({ read: true }).in("id", unreadIds).then(() => {});
    }
  }, [notifications, user]);

  useEffect(() => {
    if (!user || !isUuid(user.id)) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_requests", filter: `target_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["follow-requests-incoming", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const acceptRequest = async (req: FollowRequest) => {
    if (!user || !isUuid(user.id)) return;
    try {
      // Insert into follows. The follower is the requester, the followed is the current user.
      const { error } = await supabase.rpc("accept_follow_request" as any, { _request_id: req.id });
      if (error) throw error;
      /*
      const { error: e1 } = await supabase
        .from("follows")
        .insert({ follower_id: req.requester_id, following_id: user.id });
      if (e1 && !/duplicate/i.test(e1.message)) throw e1;

      // Remove the request (we no longer need to keep it as "accepted").
      const { error: e2 } = await supabase.from("follow_requests").delete().eq("id", req.id);
      if (e2) throw e2;

      // Notify the requester (best effort — don't fail the whole flow on this).
      const { error: e3 } = await supabase
        .from("notifications")
        .insert({ user_id: req.requester_id, actor_id: user.id, type: "follow_accepted" });
      if (e3) console.warn("notify failed", e3.message);
      */

      toast.success("Request approved");
      queryClient.invalidateQueries({ queryKey: ["follow-requests-incoming", user.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    } catch (err: any) {
      toast.error(err?.message || "Couldn't approve the request. Please try again.");
    }
  };

  const declineRequest = async (req: FollowRequest) => {
    try {
      const { error } = await supabase.from("follow_requests").delete().eq("id", req.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["follow-requests-incoming", user!.id] });
    } catch (err: any) {
      toast.error(err?.message || "Couldn't decline the request.");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart className="h-5 w-5 fill-red-500 text-red-500" />;
      case "comment": return <MessageCircle className="h-5 w-5 text-primary" />;
      case "follow":
      case "follow_request":
      case "follow_accepted":
        return <UserPlus className="h-5 w-5 text-primary" />;
      default: return null;
    }
  };

  const getMessage = (type: string) => {
    switch (type) {
      case "like": return "liked your post.";
      case "comment": return "commented on your post.";
      case "follow": return "started following you.";
      case "follow_request": return "requested to follow you.";
      case "follow_accepted": return "approved your follow request.";
      default: return "";
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Notifications</h1>
      </header>

      {requests.length > 0 && (
        <section>
          <p className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow requests</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => navigate(`/user/${r.requester_id}`)}>
                <img src={profileAvatar(r.requester?.avatar_url, r.requester_id, r.requester?.username)} className="h-11 w-11 rounded-full object-cover" alt="" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{r.requester?.username || "Someone"}</span> requested to follow you
                </p>
                <p className="text-xs text-muted-foreground">{getTimeAgo(r.created_at)}</p>
              </div>
              <button onClick={() => acceptRequest(r)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Confirm
              </button>
              <button onClick={() => declineRequest(r)} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ))}
          <div className="border-b border-border" />
        </section>
      )}

      {notifications.length === 0 && requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Heart className="h-12 w-12 mb-2" strokeWidth={1} />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div>
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => n.actor_id && navigate(`/user/${n.actor_id}`)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left ${!n.read ? "bg-primary/5" : ""}`}
            >
              <img src={profileAvatar(n.actor?.avatar_url, n.actor_id, n.actor?.username)} className="h-11 w-11 rounded-full object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{n.actor?.username || "Someone"}</span>{" "}
                  {getMessage(n.type)}{" "}
                  <span className="text-muted-foreground">{getTimeAgo(n.created_at)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {n.post?.image_url && (
                  <img src={n.post.image_url} alt="" className="h-11 w-11 object-cover rounded" />
                )}
                {!n.post_id && n.type !== "comment" && getIcon(n.type)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
