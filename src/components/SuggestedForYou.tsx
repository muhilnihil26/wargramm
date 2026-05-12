import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "./FollowButton";
import { VerifiedBadge } from "./VerifiedBadge";
import { profileAvatar } from "@/lib/avatar";

export function SuggestedForYou() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["suggested-for-you", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const [{ data: existing }, { data: requested }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("follow_requests").select("target_id").eq("requester_id", user.id),
      ]);
      const excludeIds = new Set([
        user.id,
        ...((existing || []) as any[]).map((f) => f.following_id),
        ...((requested || []) as any[]).map((r) => r.target_id),
      ]);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, full_name, is_verified")
        .order("created_at", { ascending: false })
        .limit(50);

      return (profiles || [])
        .filter((p: any) => !excludeIds.has(p.user_id))
        .slice(0, 10);
    },
  });

  if (!suggestions.length) return null;

  return (
    <div className="border-b border-border py-3">
      <div className="flex items-center justify-between px-4 pb-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Suggested for you</h2>
        <button className="text-xs font-semibold text-foreground">See All</button>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4">
          {suggestions.map((p: any) => (
            <div
              key={p.user_id}
              className="flex w-36 shrink-0 flex-col items-center rounded-lg border border-border bg-card p-3"
            >
              <button onClick={() => navigate(`/user/${p.user_id}`)} className="flex flex-col items-center">
                <img
                  src={profileAvatar(p.avatar_url, p.user_id, p.username)}
                  alt={p.username || "user"}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <p className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-foreground">
                  {p.username || "user"} <VerifiedBadge verified={p.is_verified} size={11} />
                </p>
                {p.full_name && (
                  <p className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">
                    {p.full_name}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">Suggested for you</p>
              </button>
              <div className="mt-2 w-full">
                <FollowButton targetUserId={p.user_id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
