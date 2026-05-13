import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyWeb } from "@/lib/webPush";
import { isUuid } from "@/lib/ids";
import { database } from "@/integrations/firebase/config";
import { onValue, ref, update } from "firebase/database";
import { playRingtone, stopRingtone } from "@/lib/ringtone";
import { useNavigate } from "react-router-dom";

const TYPE_TEXT: Record<string, string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  follow_request: "requested to follow you",
  follow_accepted: "approved your follow request",
};

/**
 * Global realtime listener — shows in-app toasts AND a web push notification
 * whenever a row is inserted into `notifications` for the current user, or
 * a new direct message arrives in one of their conversations.
 */
export function NotificationListener() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let callAudio: HTMLAudioElement | null = null;

    const firebaseNotifRef = ref(database, `firebaseNotifications/${user.id}`);
    const unsubscribeFirebase = onValue(firebaseNotifRef, (snapshot) => {
      const rows = snapshot.val() || {};
      Object.values(rows).forEach((n: any) => {
        if (!n || n.read) return;
        const title = n.title || "WarGram";
        const body = n.body || n.message || "";
        toast(title, body ? { description: body } : undefined);
        notifyWeb(title, body);
        if (n.id) update(ref(database, `firebaseNotifications/${user.id}/${n.id}`), { read: true }).catch(() => {});
      });
    });

    const callInviteRef = ref(database, `callInvites/${user.id}`);
    const unsubscribeCalls = onValue(callInviteRef, (snapshot) => {
      const invites = snapshot.val() || {};
      const latest = Object.values(invites)
        .filter((invite: any) => invite?.status === "ringing" && invite.from !== user.id)
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0] as any;
      if (!latest) return;
      const title = `Incoming ${latest.mode || "audio"} call`;
      toast(title, {
        action: {
          label: "Open",
          onClick: () => navigate(`/messages?to=${latest.from}`),
        },
      });
      notifyWeb("WarGram", title);
      stopRingtone(callAudio);
      callAudio = playRingtone(true);
    });

    if (!isUuid(user.id)) {
      return () => {
      unsubscribeFirebase();
      unsubscribeCalls();
      stopRingtone(callAudio);
    };
    }

    const notifChannel = supabase
      .channel(`notif-global:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const n: any = payload.new;
          const { data: actor } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", n.actor_id)
            .maybeSingle();
          const verb = TYPE_TEXT[n.type] || "sent you a notification";
          const title = `@${actor?.username || "Someone"} ${verb}`;
          toast(title);
          notifyWeb("WarGram", title);
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["unread-notif-count", user.id] });
        },
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`dm-global:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m: any = payload.new;
          if (m.sender_id === user.id) return;
          // Confirm the message belongs to a conversation this user is in
          const { data: convo } = await supabase
            .from("conversations")
            .select("user1_id, user2_id")
            .eq("id", m.conversation_id)
            .maybeSingle();
          if (!convo) return;
          if (convo.user1_id !== user.id && convo.user2_id !== user.id) return;

          const { data: sender } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", m.sender_id)
            .maybeSingle();
          const title = `New message from @${sender?.username || "someone"}`;
          // Don't toast if the user is already on the messages page
          if (!window.location.pathname.startsWith("/messages")) {
            toast(title, { description: m.content?.slice(0, 80) });
            notifyWeb(title, m.content?.slice(0, 120));
          }
          qc.invalidateQueries({ queryKey: ["unread-msg-count", user.id] });
        },
      )
      .subscribe();

    return () => {
      unsubscribeFirebase();
      unsubscribeCalls();
      stopRingtone(callAudio);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [user?.id, qc]);

  return null;
}
