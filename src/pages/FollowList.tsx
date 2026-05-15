import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FollowButton } from "@/components/FollowButton";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { hideLegacyRows } from "@/lib/legacyUsers";
import { readFirebasePublicProfile } from "@/lib/firebaseUserData";
import { get, ref } from "firebase/database";
import { database } from "@/integrations/firebase/config";

type Tab = "followers" | "following";

const FollowList = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = (searchParams.get("tab") as Tab) || "followers";

  const { data: profile } = useQuery({
    queryKey: ["follow-list-profile", userId],
    queryFn: async () => {
      if (!isUuid(userId)) {
        const data = await readFirebasePublicProfile(userId!).catch(() => null);
        return { username: data?.username || data?.email?.split("@")[0] || "User" };
      }
      const { data } = await supabase.from("profiles").select("username").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["follow-list", userId, tab],
    queryFn: async () => {
      if (!userId) return [];
      const firebaseSnap = tab === "followers"
        ? await get(ref(database, `followers/${userId}`)).catch(() => null)
        : await get(ref(database, `follows/${userId}/following`)).catch(() => null);
      const firebaseIds = firebaseSnap?.val?.() ? Object.keys(firebaseSnap.val()) : [];

      // followers = people who follow this user; following = people this user follows
      const { data: rows } = isUuid(userId)
        ? tab === "followers"
          ? await supabase.from("follows").select("follower_id").eq("following_id", userId)
          : await supabase.from("follows").select("following_id").eq("follower_id", userId)
        : { data: [] as any[] };
      const supabaseIds = (rows || []).map((r: any) => tab === "followers" ? r.follower_id : r.following_id);
      const ids = [...new Set([...supabaseIds, ...firebaseIds])];
      if (ids.length === 0) return [];

      const uuidIds = ids.filter(isUuid);
      const firebaseOnlyIds = ids.filter((id) => !isUuid(id));
      const { data: profiles } = uuidIds.length
        ? await supabase.from("profiles").select("user_id, username, avatar_url, full_name, email, created_at, updated_at").in("user_id", uuidIds)
        : { data: [] as any[] };
      const firebaseProfiles = await Promise.all(firebaseOnlyIds.map(async (id) => {
        const data = await readFirebasePublicProfile(id).catch(() => null);
        return data ? {
          user_id: id,
          username: data.username || data.email?.split("@")[0] || "user",
          avatar_url: data.avatar_url || "",
          full_name: data.full_name || "",
          email: data.email || "",
        } : null;
      }));
      return hideLegacyRows([...(profiles || []), ...firebaseProfiles.filter(Boolean)] as any[]);
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
