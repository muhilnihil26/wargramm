import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FollowButton } from "@/components/FollowButton";
import { profileAvatar } from "@/lib/avatar";

type Tab = "followers" | "following";

const FollowList = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = (searchParams.get("tab") as Tab) || "followers";

  const { data: profile } = useQuery({
    queryKey: ["follow-list-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["follow-list", userId, tab],
    queryFn: async () => {
      if (!userId) return [];
      // followers = people who follow this user; following = people this user follows
      const { data: rows } = tab === "followers"
        ? await supabase.from("follows").select("follower_id").eq("following_id", userId)
        : await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const ids = (rows || []).map((r: any) => tab === "followers" ? r.follower_id : r.following_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, full_name")
        .in("user_id", ids);
      return profiles || [];
    },
    enabled: !!userId,
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">{profile?.username || "User"}</h1>
      </header>

      <div className="mx-auto max-w-lg">
        <div className="flex border-b border-border">
          <button
            onClick={() => setSearchParams({ tab: "followers" })}
            className={`flex-1 py-3 text-sm font-semibold ${tab === "followers" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground"}`}
          >
            Followers
          </button>
          <button
            onClick={() => setSearchParams({ tab: "following" })}
            className={`flex-1 py-3 text-sm font-semibold ${tab === "following" ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground"}`}
          >
            Following
          </button>
        </div>

        {isLoading ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">
            No {tab} yet
          </p>
        ) : (
          <ul>
            {users.map((u: any) => (
              <li key={u.user_id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40">
                <button
                  onClick={() => navigate(`/user/${u.user_id}`)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <img
                    src={profileAvatar(u.avatar_url, u.user_id, u.username)}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.username || "user"}</p>
                    {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.full_name}</p>}
                  </div>
                </button>
                <FollowButton targetUserId={u.user_id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FollowList;
