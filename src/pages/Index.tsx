import { useState } from "react";
import { TopHeader } from "@/components/TopHeader";
import { StoryCircle } from "@/components/StoryCircle";
import { PostCard } from "@/components/PostCard";
import { ReelItem } from "@/components/ReelItem";
import { ShareSheet } from "@/components/ShareSheet";
import { MusicPlayer } from "@/components/MusicPlayer";
import { StoryViewer } from "@/components/StoryViewer";
import { AddStoryModal } from "@/components/AddStoryModal";
import { SuggestedForYou } from "@/components/SuggestedForYou";
import { NotesTray } from "@/components/NotesTray";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";
import { mediaOwnerAvatar, mediaOwnerId, mediaOwnerName } from "@/lib/firebaseMedia";
import { filterVisibleMediaRows } from "@/lib/visibility";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [showAddStory, setShowAddStory] = useState(false);

  // Fetch stories (not expired). RLS now enforces visibility on the server.
  const { data: storyData = [] } = useQuery({
    queryKey: ["stories", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) return [];
      const visibleStories = await filterVisibleMediaRows(data as any[], user);
      if (visibleStories.length === 0) return [];

      const userIds = [...new Set(visibleStories.map((s: any) => s.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);

      return visibleStories.map((s: any) => ({
        ...s,
        profile: profiles?.find((p: any) => p.user_id === s.user_id),
        owner_id: mediaOwnerId(s),
      }));
    },
    refetchInterval: 60000,
  });

  // Group stories by user
  const storyUsers = Array.from(
    storyData.reduce((map: Map<string, any>, s: any) => {
      const ownerId = mediaOwnerId(s);
      if (!map.has(ownerId)) {
        map.set(ownerId, {
          userId: ownerId,
          username: mediaOwnerName(s, s.profile),
          avatar: profileAvatar(mediaOwnerAvatar(s, s.profile), ownerId, mediaOwnerName(s, s.profile)),
          hasStory: true,
        });
      }
      return map;
    }, new Map()).values()
  );

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-story", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("username, avatar_url").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user && isUuid(user.id),
  });
  const ownStoryName = myProfile?.username || user?.displayName || "Your story";
  const ownStoryAvatar = profileAvatar(myProfile?.avatar_url || user?.photoURL, user?.id, ownStoryName);

  const { data: dbPosts } = useQuery({
    queryKey: ["feed-posts", user?.id],
    queryFn: async () => {
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, avatar_url, is_verified)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!postsData) return [];
      const visiblePosts = await filterVisibleMediaRows(postsData as any[], user);
      if (visiblePosts.length === 0) return [];

      const postIds = visiblePosts.map((p: any) => p.id);
      const [{ data: likeCounts }, { data: commentCounts }, { data: userLikes }] = await Promise.all([
        supabase.from("likes").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        user && isUuid(user.id) ? supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds) : Promise.resolve({ data: [] }),
      ]);

      return visiblePosts.map((p: any) => ({
        id: p.id,
        username: mediaOwnerName(p, p.profiles),
        userId: mediaOwnerId(p),
        avatar: profileAvatar(mediaOwnerAvatar(p, p.profiles), mediaOwnerId(p), mediaOwnerName(p, p.profiles)),
        image: p.image_url,
        isVideo: !!p.is_video,
        caption: p.caption || "",
        likes: likeCounts?.filter((l: any) => l.post_id === p.id).length || 0,
        comments: commentCounts?.filter((c: any) => c.post_id === p.id).length || 0,
        timeAgo: getTimeAgo(p.created_at),
        isLiked: userLikes?.some((l: any) => l.post_id === p.id) || false,
        musicUrl: p.music_url,
        musicTitle: p.music_title,
        musicStart: p.music_start,
        musicEnd: p.music_end,
        verified: !!p.profiles?.is_verified,
      }));
    },
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const { data: feedReels = [] } = useQuery({
    queryKey: ["feed-reels", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!data) return [];
      const visibleReels = await filterVisibleMediaRows(data as any[], user);
      const userIds = [...new Set(visibleReels.map((r: any) => r.user_id).filter(Boolean))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", userIds);
      return visibleReels.map((r: any) => ({
        id: r.id,
        userId: mediaOwnerId(r),
        username: mediaOwnerName(r, profiles?.find((p: any) => p.user_id === r.user_id)),
        avatar: profileAvatar(mediaOwnerAvatar(r, profiles?.find((p: any) => p.user_id === r.user_id)), mediaOwnerId(r), mediaOwnerName(r, profiles?.find((p: any) => p.user_id === r.user_id))),
        video: r.video_url,
        caption: r.caption || "",
        music: r.music_title || "Original Audio",
        musicUrl: r.music_url as string | null,
        musicStart: r.music_start as number | null,
        musicEnd: r.music_end as number | null,
      }));
    },
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const allPosts = dbPosts || [];
  const [shareReel, setShareReel] = useState<any | null>(null);
  const handleReelShare = (reel: any) => setShareReel(reel);
  const handleRemix = (reel: any) => {
    navigate("/reels", { state: { remixMusicUrl: reel.musicUrl, remixMusicTitle: reel.music } });
  };

  const handleStoryClick = (userId: string) => {
    const userStories = storyData.filter((s: any) => mediaOwnerId(s) === userId);
    if (userStories.length > 0) {
      const firstIndex = storyData.findIndex((s: any) => mediaOwnerId(s) === userId);
      setStoryViewerIndex(firstIndex);
      setShowStoryViewer(true);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader />

      {/* Stories */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-lg overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3">
            <div className="relative pt-5">
              <NotesTray inline />
              <StoryCircle
                username="Your story"
                avatar={ownStoryAvatar}
        hasStory={storyData.some((s: any) => mediaOwnerId(s) === user?.id)}
                isOwn
                onClick={() => setShowAddStory(true)}
              />
            </div>
            {storyUsers
              .filter((su: any) => su.userId !== user?.id)
              .map((su: any) => (
                <StoryCircle
                  key={su.userId}
                  username={su.username}
                  avatar={su.avatar}
                  hasStory
                  onClick={() => handleStoryClick(su.userId)}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Music Player */}
      <MusicPlayer />

      {/* Suggestions strip near the top */}
      <SuggestedForYou />

      {/* Posts + interspersed Reels */}
      <div className="mx-auto max-w-lg">
        {allPosts.map((post: any, i) => {
          // Reel after every 2 posts (pulled in order from feedReels)
          const reelIdx = Math.floor(i / 2);
          const reelToShow = feedReels[reelIdx];
          const showReel = i > 0 && i % 2 === 1 && reelToShow;
          // Suggestions every 8 posts
          const showSuggestions = i > 0 && i % 8 === 7;
          return (
            <div key={post.id || `post-${i}`}>
              <PostCard {...post} />
              {showReel && (
                <div className="border-b border-border bg-black">
                  <div className="px-4 py-2 flex items-center justify-between bg-background">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Reel · @{reelToShow.username}</span>
                  </div>
                  <ReelItem
                    id={reelToShow.id}
                    userId={reelToShow.userId}
                    username={reelToShow.username}
                    avatar={reelToShow.avatar}
                    video={reelToShow.video}
                    caption={reelToShow.caption}
                    music={reelToShow.music}
                    musicUrl={reelToShow.musicUrl}
                    musicStart={reelToShow.musicStart}
                    musicEnd={reelToShow.musicEnd}
                    speed={1}
                    globalMuted={true}
                    onShare={() => handleReelShare(reelToShow)}
                    onRemix={() => handleRemix(reelToShow)}
                  />
                </div>
              )}
              {showSuggestions && <SuggestedForYou />}
            </div>
          );
        })}

        {/* Surface any remaining reels that weren't interleaved (e.g. few posts, many reels) */}
        {(() => {
          const usedReelCount = Math.floor(allPosts.length / 2);
          const remaining = feedReels.slice(usedReelCount);
          if (remaining.length === 0) return null;
          return (
            <>
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">More reels</h2>
              </div>
              {remaining.map((reelToShow: any) => (
                <div key={`extra-reel-${reelToShow.id}`} className="border-b border-border bg-black">
                  <div className="px-4 py-2 flex items-center justify-between bg-background">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Reel · @{reelToShow.username}</span>
                  </div>
                  <ReelItem
                    id={reelToShow.id}
                    userId={reelToShow.userId}
                    username={reelToShow.username}
                    avatar={reelToShow.avatar}
                    video={reelToShow.video}
                    caption={reelToShow.caption}
                    music={reelToShow.music}
                    musicUrl={reelToShow.musicUrl}
                    musicStart={reelToShow.musicStart}
                    musicEnd={reelToShow.musicEnd}
                    speed={1}
                    globalMuted={true}
                    onShare={() => handleReelShare(reelToShow)}
                    onRemix={() => handleRemix(reelToShow)}
                  />
                </div>
              ))}
            </>
          );
        })()}

        {allPosts.length === 0 && feedReels.length === 0 && (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <p className="text-sm">Your feed is empty.</p>
            <p className="mt-1 text-xs">Follow people, or create your first post from the + tab.</p>
          </div>
        )}
      </div>

      {/* Story Viewer */}
      {showStoryViewer && storyData.length > 0 && (
        <StoryViewer
          stories={storyData}
          initialIndex={storyViewerIndex}
          onClose={() => setShowStoryViewer(false)}
        />
      )}

      {/* Add Story Modal */}
      {showAddStory && <AddStoryModal onClose={() => setShowAddStory(false)} />}

      {shareReel && (
        <ShareSheet
          shareUrl={`${window.location.origin}/?reel=${shareReel.id}`}
          shareLabel={`🎬 Reel by @${shareReel.username}`}
          onClose={() => setShareReel(null)}
        />
      )}
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default Index;
