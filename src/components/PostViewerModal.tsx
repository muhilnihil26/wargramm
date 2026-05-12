import { X } from "lucide-react";
import { PostCard } from "./PostCard";
import { profileAvatar } from "@/lib/avatar";

interface PostViewerModalProps {
  post: {
    id: string;
    user_id: string;
    image_url: string;
    is_video?: boolean;
    caption?: string | null;
    music_url?: string | null;
    music_title?: string | null;
    music_start?: number | null;
    music_end?: number | null;
    created_at: string;
  };
  profile: { username: string; avatar_url: string | null; is_verified?: boolean | null };
  onClose: () => void;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PostViewerModal({ post, profile, onClose }: PostViewerModalProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
      >
        <X className="h-6 w-6" />
      </button>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PostCard
          id={post.id}
          userId={post.user_id}
          username={profile.username}
          avatar={profileAvatar(profile.avatar_url, post.user_id, profile.username)}
          image={post.image_url}
          isVideo={!!post.is_video}
          caption={post.caption || ""}
          likes={0}
          comments={0}
          timeAgo={getTimeAgo(post.created_at)}
          musicUrl={post.music_url}
          musicTitle={post.music_title}
          musicStart={post.music_start}
          musicEnd={post.music_end}
          verified={!!profile.is_verified}
        />
      </div>
    </div>
  );
}
