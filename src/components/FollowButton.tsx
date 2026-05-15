import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isUuid } from "@/lib/ids";
import { readFirebaseFollowState, readFirebasePublicProfile, saveFirebaseFollowState } from "@/lib/firebaseUserData";
import { logCloudAction } from "@/lib/cloudActions";

interface FollowButtonProps {
  targetUserId: string;
  variant?: "default" | "outline-white" | "compact";
  onChange?: (following: boolean) => void;
}

type State = "none" | "following" | "requested";

const localFollowKey = (userId: string) => `wargram-local-follows:${userId}`;
const readLocalFollows = (userId: string): Record<string, State> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localFollowKey(userId)) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
const writeLocalFollow = (userId: string, targetUserId: string, state: State) => {
  const next = readLocalFollows(userId);
  if (state === "none") delete next[targetUserId];
  else next[targetUserId] = state;
  localStorage.setItem(localFollowKey(userId), JSON.stringify(next));
};

export function FollowButton({ targetUserId, variant = "default", onChange }: FollowButtonProps) {
  const { user } = useAuth();
  const [state, setState] = useState<State>("none");
  const [targetPrivate, setTargetPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    let cancelled = false;
    (async () => {
      const localState = readLocalFollows(user.id)[targetUserId];
      if (localState) {
        setState(localState);
        return;
      }
      if (!isUuid(user.id) || !isUuid(targetUserId)) {
        const [firebaseState, targetProfile] = await Promise.all([
          readFirebaseFollowState(user.id, targetUserId).catch(() => "none" as State),
          readFirebasePublicProfile(targetUserId).catch(() => null),
        ]);
        if (cancelled) return;
        setTargetPrivate(!!targetProfile?.is_private);
        setState(firebaseState as State);
        return;
      }
      const [{ data: follow }, { data: prof }, { data: req }] = await Promise.all([
        supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle(),
        supabase.from("profiles").select("is_private").eq("user_id", targetUserId).maybeSingle(),
        supabase.from("follow_requests").select("id, status").eq("requester_id", user.id).eq("target_id", targetUserId).maybeSingle(),
      ]);
      if (cancelled) return;
      setTargetPrivate(!!(prof as any)?.is_private);
      if (follow) setState("following");
      else if (req && (req as any).status === "pending") setState("requested");
      else setState("none");
    })();
    return () => { cancelled = true; };
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    if (state === "following") {
      setState("none");
      writeLocalFollow(user.id, targetUserId, "none");
      onChange?.(false);
      await logCloudAction(user, "unfollow", { target_user_id: targetUserId }).catch(() => {});
      await saveFirebaseFollowState(user.id, targetUserId, "none").catch(() => {});
      if (isUuid(user.id) && isUuid(targetUserId)) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      }
    } else if (state === "requested") {
      setState("none");
      writeLocalFollow(user.id, targetUserId, "none");
      if (isUuid(user.id) && isUuid(targetUserId)) {
        await supabase.from("follow_requests").delete().eq("requester_id", user.id).eq("target_id", targetUserId);
      }
      await saveFirebaseFollowState(user.id, targetUserId, "none").catch(() => {});
      await logCloudAction(user, "follow_request_cancel", { target_user_id: targetUserId }).catch(() => {});
      toast.success("Request cancelled");
    } else {
      // none
      if (targetPrivate) {
        if (!isUuid(user.id) || !isUuid(targetUserId)) {
          setState("requested");
          writeLocalFollow(user.id, targetUserId, "requested");
          await saveFirebaseFollowState(user.id, targetUserId, "requested").catch(() => {});
          await logCloudAction(user, "follow_request", { target_user_id: targetUserId }).catch(() => {});
          toast.success("Request saved");
          setLoading(false);
          return;
        }
        const { error } = await supabase.from("follow_requests").insert({ requester_id: user.id, target_id: targetUserId } as any);
        if (!error) {
          setState("requested");
          writeLocalFollow(user.id, targetUserId, "requested");
          await logCloudAction(user, "follow_request", { target_user_id: targetUserId }).catch(() => {});
          await saveFirebaseFollowState(user.id, targetUserId, "requested").catch(() => {});
          await supabase.from("notifications").insert({ user_id: targetUserId, actor_id: user.id, type: "follow_request" });
          toast.success("Request sent");
        } else {
          setState("requested");
          writeLocalFollow(user.id, targetUserId, "requested");
          await logCloudAction(user, "follow_request", { target_user_id: targetUserId }).catch(() => {});
          await saveFirebaseFollowState(user.id, targetUserId, "requested").catch(() => {});
          toast.success("Request saved");
        }
      } else {
        setState("following");
        writeLocalFollow(user.id, targetUserId, "following");
        onChange?.(true);
        const { error } = isUuid(user.id) && isUuid(targetUserId)
          ? await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId })
          : { error: null };
        await saveFirebaseFollowState(user.id, targetUserId, "following").catch(() => {});
        await logCloudAction(user, "follow", { target_user_id: targetUserId }).catch(() => {});
        if (!error) {
          if (isUuid(user.id) && isUuid(targetUserId)) await supabase.from("notifications").insert({ user_id: targetUserId, actor_id: user.id, type: "follow" });
          toast.success("Following");
        } else {
          toast.success("Following saved");
        }
      }
    }
    if ((state === "following" || state === "requested") && (!isUuid(user.id) || !isUuid(targetUserId))) {
      await saveFirebaseFollowState(user.id, targetUserId, "none").catch(() => {});
    }
    setLoading(false);
  };

  const baseClasses = "px-3 py-1 rounded-md text-xs font-semibold transition-colors disabled:opacity-50";
  const label = state === "following" ? "Following" : state === "requested" ? "Requested" : "Follow";
  const styleMap = {
    "default": state !== "none"
      ? "bg-secondary text-foreground hover:bg-secondary/80"
      : "bg-primary text-primary-foreground hover:bg-primary/90",
    "outline-white": state !== "none"
      ? "border border-white/60 text-white"
      : "border border-white text-white hover:bg-white hover:text-black",
    "compact": state !== "none"
      ? "text-muted-foreground"
      : "text-primary",
  };

  return (
    <button onClick={toggle} disabled={loading} className={`${baseClasses} ${styleMap[variant]}`}>
      {label}
    </button>
  );
}
