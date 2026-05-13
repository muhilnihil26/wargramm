import { useState } from "react";
import { Grid3X3, Film, Bookmark, UserPlus, Menu } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { EditProfileModal } from "@/components/EditProfileModal";
import { SettingsSheet } from "@/components/SettingsSheet";
import { PostViewerModal } from "@/components/PostViewerModal";
import { InviteSheet } from "@/components/InviteSheet";
import { ImageViewer } from "@/components/ImageViewer";
import { AppLoading } from "@/components/AppLoading";
import { profileAvatar } from "@/lib/avatar";
import { getKnownProfile } from "@/lib/knownUsers";
import { isUuid } from "@/lib/ids";
import { readClientProfile } from "@/lib/cloudProfile";
import { getYouTubeId, youtubeThumbnail } from "@/lib/youtube";
import { readFirebasePostBookmarks } from "@/lib/firebaseUserData";

type TabType = "posts" | "reels" | "saved";

const Profile = () => {
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (!isUuid(user.id)) {
        return readClientProfile(user);
      }
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      const knownProfile = getKnownProfile(user.email);
      return data || {
        user_id: user.id,
        username: knownProfile?.username || user.email?.split("@")[0] || "user",
        full_name: knownProfile?.fullName || user.displayName || "",
        avatar_url: user.photoURL || "",
        bio: "",
        is_private: false,
        is_verified: false,
      };
    },
    enabled: !!user,
  });

  const { data: userPosts } = useQuery({
    queryKey: ["user-posts", user?.id],
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("posts").select("*").eq(isUuid(user.id) ? "user_id" : "firebase_uid", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: userReels } = useQuery({
    queryKey: ["user-reels", user?.id],
    staleTime: 5_000,
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("reels").select("*").eq(isUuid(user.id) ? "user_id" : "firebase_uid", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: savedPosts } = useQuery({
    queryKey: ["saved-posts", user?.id],
    queryFn: async () => {
      if (!user || !isUuid(user.id)) return [];
      const { data: rows } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
      const ids = (rows || []).map((r: any) => r.post_id);
      if (ids.length === 0) return [];
      const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
      return posts || [];
    },
    enabled: !!user,
  });

  const { data: clientSavedPosts } = useQuery({
    queryKey: ["client-saved-posts", user?.id],
    queryFn: async () => {
      if (!user || isUuid(user.id)) return [];
      const localIds = Object.keys(localStorage)
        .filter((key) => key.startsWith(`wargram-local-save:post:${user.id}:`) && localStorage.getItem(key) === "true")
        .map((key) => key.split(":").pop())
        .filter(Boolean) as string[];
      const firebaseIds = await readFirebasePostBookmarks(user.id).catch(() => []);
      const ids = [...new Set([...firebaseIds, ...localIds])];
      if (ids.length === 0) return [];
      const { data: posts } = await supabase.from("posts").select("*").in("id", ids);
      return posts || [];
    },
    enabled: !!user && !isUuid(user.id),
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    staleTime: 5_000,
    queryFn: async () => {
      if (!user) return { posts: 0, followers: 0, following: 0 };
      if (!isUuid(user.id)) {
        const [{ count: postCount }, { count: reelCount }] = await Promise.all([
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("firebase_uid", user.id),
          supabase.from("reels").select("*", { count: "exact", head: true }).eq("firebase_uid", user.id),
        ]);
        return { posts: (postCount || 0) + (reelCount || 0), followers: 0, following: 0 };
      }
      const [{ count: postCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
      ]);
      return { posts: postCount || 0, followers: followerCount || 0, following: followingCount || 0 };
    },
    enabled: !!user,
  });

  const tabs = [
    { id: "posts" as TabType, icon: Grid3X3 },
    { id: "reels" as TabType, icon: Film },
    { id: "saved" as TabType, icon: Bookmark },
  ];

  if (!user || !profile) {
    return <AppLoading />;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-foreground inline-flex items-center gap-1">
          {(profile as any).is_private && <span title="Private account">🔒</span>}
          {profile.username}
          <VerifiedBadge verified={(profile as any).is_verified} size={16} />
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowInvite(true)} className="text-foreground" aria-label="Invite friends"><UserPlus className="h-6 w-6" strokeWidth={1.5} /></button>
          <button onClick={() => setShowSettings(true)} className="text-foreground" aria-label="Settings">
            <Menu className="h-6 w-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg">
        <div className="px-4 py-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => profile.avatar_url && setViewingAvatar(true)}
              className="rounded-full p-[3px] gradient-story focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="View profile photo"
            >
              <div className="rounded-full border-2 border-background">
                <img src={profileAvatar(profile.avatar_url, user.id, profile.username)} alt={profile.username || ""} className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover" />
              </div>
            </button>
            <div className="flex flex-1 justify-around text-center">
              <div><p className="text-lg font-bold text-foreground">{stats?.posts ?? 0}</p><p className="text-xs text-muted-foreground">Posts</p></div>
              <button onClick={() => navigate(`/user/${user.id}/follows?tab=followers`)} className="focus:outline-none">
                <p className="text-lg font-bold text-foreground">{stats?.followers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </button>
              <button onClick={() => navigate(`/user/${user.id}/follows?tab=following`)} className="focus:outline-none">
                <p className="text-lg font-bold text-foreground">{stats?.following ?? 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
              {profile.full_name || profile.username}
              <VerifiedBadge verified={(profile as any).is_verified} />
            </p>
            {profile.bio && <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">{profile.bio}</p>}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowEditProfile(true)} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-semibold text-foreground">
              Edit Profile
            </button>
            <button onClick={() => navigate("/youtube")} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-semibold text-foreground">
              YouTube
            </button>
          </div>
        </div>

        <div className="flex border-t border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex justify-center transition-colors ${activeTab === tab.id ? "border-t border-foreground text-foreground" : "text-muted-foreground"}`}
            >
              <tab.icon className="h-6 w-6" strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {activeTab === "posts" && (
          <div className="grid grid-cols-3 gap-0.5">
            {(userPosts || []).map((post: any) => (
              <button key={post.id} onClick={() => setViewingPost(post)} className="relative aspect-square overflow-hidden bg-black">
                {getYouTubeId(post.image_url) ? (
                  <img src={youtubeThumbnail(post.image_url) || post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : post.is_video ? (
                  <video src={post.image_url} className="h-full w-full object-cover" muted preload="metadata" />
                ) : (
                  <img src={post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </button>
            ))}
            {(!userPosts || userPosts.length === 0) && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Grid3X3 className="h-12 w-12 mb-2" strokeWidth={1} /><p className="text-sm">No posts yet</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "reels" && (
          <div className="grid grid-cols-3 gap-0.5">
            {(userReels || []).map((r: any) => (
              <button key={r.id} onClick={() => setViewingPost({ ...r, image_url: r.video_url, is_video: true })} className="relative aspect-[9/16] overflow-hidden bg-black">
                {getYouTubeId(r.video_url) ? (
                  <img src={youtubeThumbnail(r.video_url) || r.video_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <video src={r.video_url} className="h-full w-full object-cover" muted preload="metadata" />
                )}
                <Film className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" />
              </button>
            ))}
            {(!userReels || userReels.length === 0) && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Film className="h-12 w-12 mb-2" strokeWidth={1} /><p className="text-sm">No reels yet</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "saved" && (
          <div className="grid grid-cols-3 gap-0.5">
            {((isUuid(user.id) ? savedPosts : clientSavedPosts) || []).map((p: any) => (
              <button key={p.id} onClick={() => setViewingPost(p)} className="relative aspect-square overflow-hidden bg-black">
                <img src={youtubeThumbnail(p.image_url) || p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
            {(!(isUuid(user.id) ? savedPosts : clientSavedPosts) || (isUuid(user.id) ? savedPosts : clientSavedPosts)!.length === 0) && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bookmark className="h-12 w-12 mb-2" strokeWidth={1} /><p className="text-sm">No saved posts</p>
              </div>
            )}
          </div>
        )}
      </div>

      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          profile={{ username: profile.username || "user", avatar_url: profile.avatar_url, is_verified: (profile as any).is_verified }}
          onClose={() => setViewingPost(null)}
        />
      )}
      {showInvite && <InviteSheet onClose={() => setShowInvite(false)} />}
      {viewingAvatar && profile.avatar_url && (
        <ImageViewer src={profile.avatar_url} alt={profile.username || ""} onClose={() => setViewingAvatar(false)} />
      )}

      {showEditProfile && <EditProfileModal profile={profile} onClose={() => setShowEditProfile(false)} />}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} onEditProfile={() => setShowEditProfile(true)} />}
    </div>
  );
};

export default Profile;
