import { useState } from "react";
import { BadgeCheck, Flame, Search, Sparkles, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PostViewerModal } from "@/components/PostViewerModal";
import { profileAvatar } from "@/lib/avatar";
import { mediaOwnerAvatar, mediaOwnerName } from "@/lib/firebaseMedia";
import { getYouTubeId, youtubeThumbnail } from "@/lib/youtube";
import { searchUsersEverywhere } from "@/lib/userDirectory";
import { filterVisibleMediaRows } from "@/lib/visibility";

const demoPosts = [
  {
    id: "demo-fashion",
    image_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    caption: "Fresh street style ideas",
    is_video: false,
    user_id: "demo-fashion",
    profiles: { username: "wargram_style", avatar_url: null, is_verified: true },
  },
  {
    id: "demo-travel",
    image_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    caption: "Places worth saving",
    is_video: false,
    user_id: "demo-travel",
    profiles: { username: "travel_feed", avatar_url: null, is_verified: true },
  },
  {
    id: "demo-music",
    image_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
    caption: "Music moments",
    is_video: false,
    user_id: "demo-music",
    profiles: { username: "music_daily", avatar_url: null, is_verified: false },
  },
  {
    id: "demo-food",
    image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    caption: "Food finds",
    is_video: false,
    user_id: "demo-food",
    profiles: { username: "tasteboard", avatar_url: null, is_verified: false },
  },
  {
    id: "demo-tech",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
    caption: "Creator setup inspiration",
    is_video: false,
    user_id: "demo-tech",
    profiles: { username: "creator_lab", avatar_url: null, is_verified: false },
  },
  {
    id: "demo-sport",
    image_url: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=900&q=80",
    caption: "Weekend energy",
    is_video: false,
    user_id: "demo-sport",
    profiles: { username: "sport_pulse", avatar_url: null, is_verified: false },
  },
];

const topics = ["For you", "Trending", "Creators", "Music", "Travel", "Style"];

const Explore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: explorePosts = [] } = useQuery({
    queryKey: ["explore-posts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified)")
        .order("created_at", { ascending: false })
        .limit(60);
      const visible = await filterVisibleMediaRows((data || []) as any[], user);
      return visible.length > 0 ? visible : demoPosts;
    },
  });

  const { data: celebrityUsers = [] } = useQuery({
    queryKey: ["explore-celebrities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, is_verified, is_celebrity, celebrity_score")
        .or("is_celebrity.eq.true,is_verified.eq.true")
        .order("celebrity_score", { ascending: false })
        .limit(12);
      return data || [];
    },
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
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
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="mx-auto max-w-lg px-4">
          {searchResults.length === 0 && !searching ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="py-2 space-y-1">
              {searchResults.map((u) => (
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
            </div>
          )}
        </div>
      )}

      {/* Clickable feed grid */}
      {searchQuery.length < 2 && (
        <div className="mx-auto max-w-lg">
          <div className="px-4 pb-3">
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
              {explorePosts.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setViewing(p)}
                  className="relative aspect-square overflow-hidden bg-secondary"
                >
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
