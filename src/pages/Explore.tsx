import { useState } from "react";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PostViewerModal } from "@/components/PostViewerModal";
import { profileAvatar } from "@/lib/avatar";

const Explore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: explorePosts = [] } = useQuery({
    queryKey: ["explore-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, avatar_url)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, full_name, avatar_url, bio")
      .neq("user_id", user?.id || "")
      .ilike("username", `%${query}%`)
      .limit(15);
    setSearchResults(data || []);
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
                  onClick={() => { setSearchQuery(""); setSearchResults([]); navigate(`/user/${u.user_id}`); }}
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
        <div className="mx-auto max-w-lg px-0.5">
          {explorePosts.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No posts to explore yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {explorePosts.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setViewing(p)}
                  className="relative aspect-square overflow-hidden bg-secondary"
                >
                  {p.is_video ? (
                    <video src={p.image_url} muted className="h-full w-full object-cover" />
                  ) : (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover transition-opacity hover:opacity-80" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewing && (
        <PostViewerModal
          post={viewing}
          profile={{
            username: viewing.profiles?.username || "user",
            avatar_url: viewing.profiles?.avatar_url || null,
            is_verified: viewing.profiles?.is_verified || false,
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
};

export default Explore;
