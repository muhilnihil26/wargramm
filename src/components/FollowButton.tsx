import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FollowButtonProps {
  targetUserId: string;
  variant?: "default" | "outline-white" | "compact";
  onChange?: (following: boolean) => void;
}

type State = "none" | "following" | "requested";

export function FollowButton({ targetUserId, variant = "default", onChange }: FollowButtonProps) {
  const { user } = useAuth();
  const [state, setState] = useState<State>("none");
  const [targetPrivate, setTargetPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    let cancelled = false;
    (async () => {
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
      onChange?.(false);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    } else if (state === "requested") {
      setState("none");
      await supabase.from("follow_requests").delete().eq("requester_id", user.id).eq("target_id", targetUserId);
      toast.success("Request cancelled");
    } else {
      // none
      if (targetPrivate) {
        const { error } = await supabase.from("follow_requests").insert({ requester_id: user.id, target_id: targetUserId } as any);
        if (!error) {
          setState("requested");
          await supabase.from("notifications").insert({ user_id: targetUserId, actor_id: user.id, type: "follow_request" });
          toast.success("Request sent");
        } else {
          toast.error(error.message);
        }
      } else {
        setState("following");
        onChange?.(true);
        const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
        if (!error) {
          await supabase.from("notifications").insert({ user_id: targetUserId, actor_id: user.id, type: "follow" });
          toast.success("Following");
        }
      }
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
