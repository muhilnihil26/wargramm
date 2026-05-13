import { useState } from "react";
import { ArrowLeft, Film, Grid3X3, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { isOnline } from "@/hooks/usePresence";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PostViewerModal } from "@/components/PostViewerModal";
import { ImageViewer } from "@/components/ImageViewer";
import { profileAvatar } from "@/lib/avatar";
import { listVisibleKnownProfiles } from "@/lib/knownUsers";
import { getYouTubeId, youtubeThumbnail } from "@/lib/youtube";
import { readFirebaseFollowCounts, readFirebaseFollowState, readFirebaseMedia, readFirebasePublicProfile, saveFirebaseFollowState } from "@/lib/firebaseUserData";
import { filterVisibleMediaRows } from "@/lib/visibility";
import { mediaOwnerId } from "@/lib/firebaseMedia";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string | null) => !!value && value !== "undefined" && UUID_RE.test(value);

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [viewingAvatar, setViewingAvatar] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      if (!isUuid(userId)) {
        const data = await readFirebasePublicProfile(userId!).catch(() => null);
        const adminFallback = listVisibleKnownProfiles().find((p) => p.user_id === userId);
        if (data) {
          return {
            user_id: data.firebase_uid,
            username: data.username || data.email?.split("@")[0] || "user",
            full_name: data.full_name || "",
            avatar_url: data.avatar_url || "",
            bio: data.bio || "",
            is_private: !!data.is_private,
            show_activity: data.show_activity !== false,
            is_verified: !!data.is_verified,
          };
        }
        return adminFallback ? {
          user_id: adminFallback.user_id,
          username: adminFallback.username,
          full_name: adminFallback.full_name,
          avatar_url: adminFallback.avatar_url,
          bio: "",
          is_private: false,
          show_activity: true,
          is_verified: adminFallback.is_verified,
        } : null;
      }
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: stats } = useQuery({
    queryKey: ["user-profile-stats", userId],
    queryFn: async () => {
      if (!isUuid(userId)) {
        const [{ count: postCount }, { count: reelCount }, followCounts] = await Promise.all([
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("firebase_uid", userId!),
          supabase.from("reels").select("*", { count: "exact", head: true }).eq("firebase_uid", userId!),
          readFirebaseFollowCounts(userId!).catch(() => ({ followers: 0, following: 0 })),
        ]);
        return { posts: (postCount || 0) + (reelCount || 0), followers: followCounts.followers, following: followCounts.following };
      }
      const [{ count: postCount }, { count: reelCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId!),
        supabase.from("reels").select("*", { count: "exact", head: true }).eq("user_id", userId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId!),
      ]);
      return { posts: (postCount || 0) + (reelCount || 0), followers: followerCount || 0, following: followingCount || 0 };
    },
    enabled: !!userId,
  });

  const { data: relation } = useQuery({
    queryKey: ["relation", user?.id, userId],
    enabled: !!user && !!userId && user?.id !== userId,
    queryFn: async () => {
      if (!isUuid(user?.id) || !isUuid(userId)) {
        const state = await readFirebaseFollowState(user!.id, userId!).catch(() => "none");
        return { following: state === "following", requested: state === "requested" };
      }
      const [{ data: follow }, { data: req }] = await Promise.all([
        supabase.from("follows").select("id").eq("follower_id", user!.id).eq("following_id", userId!).maybeSingle(),
        supabase.from("follow_requests").select("id, status").eq("requester_id", user!.id).eq("target_id", userId!).maybeSingle(),
      ]);
      return { following: !!follow, requested: !!(req && (req as any).status === "pending") };
    },
  });

  const isPrivate = !!(profile as any)?.is_private;
  const isOwner = user?.id === userId;
  const canSeePosts = isOwner || !isPrivate || !!relation?.following;

  const { data: posts } = useQuery({
    queryKey: ["user-profile-posts", userId, canSeePosts],
    enabled: !!userId && canSeePosts,
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").eq(isUuid(userId) ? "user_id" : "firebase_uid", userId!).order("created_at", { ascending: false });
      const { data: reels } = await supabase.from("reels").select("*").eq(isUuid(userId) ? "user_id" : "firebase_uid", userId!).order("created_at", { ascending: false });
      const [firebasePosts, firebaseReels] = await Promise.all([
        readFirebaseMedia("post").catch(() => []),
        readFirebaseMedia("reel").catch(() => []),
      ]);
      const rows = [
        ...(data || []).map((p: any) => ({ ...p, _kind: "post" })),
        ...(reels || []).map((r: any) => ({ ...r, _kind: "reel", image_url: r.video_url, is_video: true })),
        ...firebasePosts.filter((p: any) => mediaOwnerId(p) === userId).map((p: any) => ({ ...p, _kind: "post" })),
        ...firebaseReels.filter((r: any) => mediaOwnerId(r) === userId).map((r: any) => ({ ...r, _kind: "reel", image_url: r.video_url, is_video: true })),
      ].sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
      return filterVisibleMediaRows(rows as any[], user);
    },
  });

  const followAction = useMutation({
    mutationFn: async () => {
      if (!user || !userId) return;
      if (!isUuid(user.id) || !isUuid(userId)) {
        if (relation?.following || relation?.requested) {
          await saveFirebaseFollowState(user.id, userId!, "none");
        } else {
          await saveFirebaseFollowState(user.id, userId!, isPrivate ? "requested" : "following");
        }
        return;
      }
      if (relation?.following) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      } else if (relation?.requested) {
        await supabase.from("follow_requests").delete().eq("requester_id", user.id).eq("target_id", userId);
      } else {
        if (isPrivate) {
          await supabase.from("follow_requests").insert({ requester_id: user.id, target_id: userId } as any);
          await supabase.from("notifications").insert({ user_id: userId, actor_id: user.id, type: "follow_request" });
        } else {
          await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
          await supabase.from("notifications").insert({ user_id: userId, actor_id: user.id, type: "follow" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relation", user?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-stats", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  const followLabel = relation?.following ? "Following" : relation?.requested ? "Requested" : "Follow";

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground inline-flex items-center gap-1">
          {isPrivate && <Lock className="h-4 w-4" />} {profile.username}
          <VerifiedBadge verified={(profile as any).is_verified} size={16} />
        </h1>
      </header>

      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="flex items-center gap-6">
          <button onClick={() => profile?.avatar_url && setViewingAvatar(true)} aria-label="View profile photo" className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
            <img src={profileAvatar(profile.avatar_url, userId, profile.username)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover" />
          </button>
          <div className="flex flex-1 justify-around text-center">
            <div><p className="text-lg font-bold text-foreground">{stats?.posts ?? 0}</p><p className="text-xs text-muted-foreground">Posts</p></div>
            <button onClick={() => navigate(`/user/${userId}/follows?tab=followers`)} className="focus:outline-none">
              <p className="text-lg font-bold text-foreground">{stats?.followers ?? 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button onClick={() => navigate(`/user/${userId}/follows?tab=following`)} className="focus:outline-none">
              <p className="text-lg font-bold text-foreground">{stats?.following ?? 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-foreground">{profile.full_name || profile.username}</p>
          {profile.bio && <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">{profile.bio}</p>}
          {(profile as any).show_activity && (profile as any).last_seen && (
            <p className="mt-1 text-xs text-muted-foreground">
              {isOnline((profile as any).last_seen) ? "Active now" : `Last seen ${new Date((profile as any).last_seen).toLocaleString()}`}
            </p>
          )}
        </div>

        {!isOwner && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => followAction.mutate()}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${
                relation?.following || relation?.requested
                  ? "bg-secondary text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {followLabel}
            </button>
            <button onClick={() => navigate(`/messages?to=${userId}`)} className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-semibold text-foreground">
              Message
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border mx-auto max-w-lg">
        {canSeePosts ? (
          <div className="grid grid-cols-3 gap-0.5">
            {posts?.map((post: any) => (
              <button key={post.id} onClick={() => setViewingPost(post)} className="relative aspect-square overflow-hidden bg-black">
                {post._kind === "reel" && <Film className="absolute right-2 top-2 z-10 h-4 w-4 text-white drop-shadow" />}
                {getYouTubeId(post.image_url) ? (
                  <img src={youtubeThumbnail(post.image_url) || post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : post.is_video ? (
                  <video src={post.image_url} className="h-full w-full object-cover" muted preload="metadata" />
                ) : (
                  <img src={post.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </button>
            ))}
            {(!posts || posts.length === 0) && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Grid3X3 className="h-12 w-12 mb-2" strokeWidth={1} />
                <p className="text-sm">No posts yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Lock className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">This account is private</p>
            <p className="text-xs">Follow to see their photos and videos.</p>
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
      {viewingAvatar && profile?.avatar_url && (
        <ImageViewer src={profile.avatar_url} alt={profile.username || ""} onClose={() => setViewingAvatar(false)} />
      )}
    </div>
  );
};

export default UserProfile;
