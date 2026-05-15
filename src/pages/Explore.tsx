import { useState } from "react";
import { BadgeCheck, Film, Flame, Grid3X3, Search, Sparkles, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PostViewerModal } from "@/components/PostViewerModal";
import { profileAvatar } from "@/lib/avatar";
import { mediaOwnerAvatar, mediaOwnerId, mediaOwnerName } from "@/lib/firebaseMedia";
import { getYouTubeId, youtubeThumbnail } from "@/lib/youtube";
import { searchUsersEverywhere } from "@/lib/userDirectory";
import { filterVisibleMediaRows } from "@/lib/visibility";
import { readFirebaseMedia } from "@/lib/firebaseUserData";
import { hideLegacyRows } from "@/lib/legacyUsers";

const topics = ["For you", "Trending", "Creators", "Music", "Travel", "Style"];
type ExploreFilter = "all" | "posts" | "reels" | "people";

const Explore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [filter, setFilter] = useState<ExploreFilter>("all");
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("wargram-recent-searches") || "[]"); } catch { return []; }
  });

  const { data: explorePosts = [] } = useQuery({
    queryKey: ["explore-posts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified, email, created_at, updated_at)")
        .order("created_at", { ascending: false })
        .limit(60);
      const firebasePosts = await readFirebaseMedia("post").catch(() => []);
      const visible = await filterVisibleMediaRows([...(data || []), ...firebasePosts] as any[], user);
      return visible.map((p: any) => ({ ...p, _kind: "post" }));
    },
  });

  const { data: exploreReels = [] } = useQuery({
    queryKey: ["explore-reels", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      const firebaseReels = await readFirebaseMedia("reel").catch(() => []);
      const visible = await filterVisibleMediaRows([...(data || []), ...firebaseReels] as any[], user);
      return visible.map((r: any) => ({ ...r, _kind: "reel", image_url: r.video_url, is_video: true }));
    },
  });

  const visibleMedia = [...explorePosts, ...exploreReels]
    .sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));

  const searchMedia = searchQuery.length >= 2
    ? visibleMedia.filter((item: any) => {
        if (filter === "people") return false;
        if (filter === "posts" && item._kind !== "post") return false;
        if (filter === "reels" && item._kind !== "reel") return false;
        const text = `${item.caption || ""} ${mediaOwnerName(item, item.profiles)}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase());
      })
    : [];

  const { data: celebrityUsers = [] } = useQuery({
    queryKey: ["explore-celebrities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, is_verified, is_celebrity, celebrity_score, email, created_at, updated_at")
        .or("is_celebrity.eq.true,is_verified.eq.true")
        .order("celebrity_score", { ascending: false })
        .limit(12);
      return hideLegacyRows(data || []);
    },
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const nextRecent = [query, ...recent.filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 6);
    setRecent(nextRecent);
    localStorage.setItem("wargram-recent-searches", JSON.stringify(nextRecent));
    setSearchResults(await searchUsersEverywhere(query, user?.id, 15));
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users or browse feed..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {([
              ["all", "All", Sparkles],
              ["people", "People", Users],
              ["posts", "Posts", Grid3X3],
              ["reels", "Reels", Film],
            ] as [ExploreFilter, string, typeof Sparkles][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="mx-auto max-w-lg px-4">
          {searchResults.length === 0 && searchMedia.length === 0 && !searching ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">No results found</p>
            </div>
          ) : (
            <div className="py-2 space-y-1">
              {(filter === "all" || filter === "people") && searchResults.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => {
                    setSearchQuery(""); setSearchResults([]); navigate(`/user/${u.user_id}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-secondary"
                >
                  <img
                    src={profileAvatar(u.avatar_url, u.user_id, u.username)}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-foreground">{u.username}</p>
                    {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.full_name}</p>}
                  </div>
                </button>
              ))}
              {(filter === "all" || filter === "posts" || filter === "reels") && searchMedia.length > 0 && (
                <div className="grid grid-cols-3 gap-0.5 pt-3">
                  {searchMedia.map((item: any) => (
                    <button key={`${item._kind}-${item.id}`} onClick={() => setViewing(item)} className="relative aspect-square overflow-hidden bg-secondary">
                      {item._kind === "reel" && <Film className="absolute right-2 top-2 z-10 h-4 w-4 text-white drop-shadow" />}
                      {getYouTubeId(item.image_url) ? (
                        <img src={youtubeThumbnail(item.image_url) || item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : item.is_video ? (
                        <video src={item.image_url} muted className="h-full w-full object-cover" />
                      ) : (
                        <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clickable feed grid */}
      {searchQuery.length < 2 && (
        <div className="mx-auto max-w-lg">
          <div className="px-4 pb-3">
            {recent.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent searches</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {recent.map((q) => (
                    <button key={q} onClick={() => handleSearch(q)} className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-secondary to-background p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="text-sm font-bold text-foreground">Browse what is moving now</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Trending posts, creators, and fresh ideas update here as people post.</p>
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {topics.map((t) => (
                  <span key={t} className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {celebrityUsers.length > 0 && (
            <div className="px-4 pb-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-1 text-sm font-bold text-foreground"><Flame className="h-4 w-4 text-primary" /> Celebrities</h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin picked</span>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                {celebrityUsers.map((u: any) => (
                  <button key={u.user_id} onClick={() => navigate(`/user/${u.user_id}`)} className="w-20 shrink-0 text-center">
                    <div className="relative mx-auto h-16 w-16 rounded-full p-[2px] gradient-story">
                      <img src={profileAvatar(u.avatar_url, u.user_id, u.username)} alt="" className="h-full w-full rounded-full border-2 border-background object-cover" />
                      <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 fill-primary text-primary-foreground" />
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-foreground">{u.username || "user"}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex items-center gap-2 px-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Explore feed</h2>
          </div>
          <div className="px-0.5">
            <div className="grid grid-cols-3 gap-0.5">
              {visibleMedia
                .filter((p: any) => filter === "all" || (filter === "posts" && p._kind === "post") || (filter === "reels" && p._kind === "reel"))
                .map((p: any) => (
                <button
                  key={`${p._kind}-${p.id}`}
                  onClick={() => setViewing(p)}
                  className="relative aspect-square overflow-hidden bg-secondary"
                >
                  {p._kind === "reel" && <Film className="absolute right-2 top-2 z-10 h-4 w-4 text-white drop-shadow" />}
                  {getYouTubeId(p.image_url) ? (
                    <img src={youtubeThumbnail(p.image_url) || p.image_url} alt="" className="h-full w-full object-cover transition-opacity hover:opacity-80" loading="lazy" />
                  ) : p.is_video ? (
                    <video src={p.image_url} muted className="h-full w-full object-cover" />
                  ) : (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover transition-opacity hover:opacity-80" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <PostViewerModal
          post={viewing}
          profile={{
            username: mediaOwnerName(viewing, viewing.profiles),
            avatar_url: mediaOwnerAvatar(viewing, viewing.profiles) || null,
            is_verified: viewing.profiles?.is_verified || false,
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
};

export default Explore;
