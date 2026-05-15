import { useState, useEffect, useRef } from "react";
import { X, Pause, Play } from "lucide-react";
import { YouTubeAudio } from "./YouTubeAudio";
import { YouTubeEmbedFrame } from "./YouTubeEmbedFrame";
import { profileAvatar } from "@/lib/avatar";
import { getYouTubeId } from "@/lib/youtube";

interface Story {
  id: string;
  image_url: string;
  created_at: string;
  user_id: string;
  owner_id?: string;
  firebase_display_name?: string | null;
  firebase_photo_url?: string | null;
  music_url?: string | null;
  music_title?: string | null;
  profile?: { username: string; avatar_url: string | null };
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 5000;

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

export function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const story = stories[currentIndex];
  const youTubeId = story ? getYouTubeId(story.image_url) : null;
  const isYouTube = !!youTubeId;
  const isVideo = story && !isYouTube && isVideoUrl(story.image_url);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, [currentIndex]);

  // Drive progress (image stories — fixed duration; video stories — driven by element)
  useEffect(() => {
    if (!story) return;
    if (isVideo) return; // handled by video timeupdate
    if (paused) {
      // pause snapshot
      elapsedRef.current += Date.now() - startRef.current;
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const total = elapsedRef.current + (Date.now() - startRef.current);
      const pct = Math.min(100, (total / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        if (currentIndex < stories.length - 1) setCurrentIndex(currentIndex + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [paused, currentIndex, isVideo, story, stories.length, onClose]);

  // Video pause/play sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => {});
  }, [paused, currentIndex]);

  if (!story) return null;

  const getTimeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const goPrev = () => (currentIndex > 0 ? setCurrentIndex(currentIndex - 1) : onClose());
  const goNext = () => (currentIndex < stories.length - 1 ? setCurrentIndex(currentIndex + 1) : onClose());
  const ownerId = story.owner_id || story.user_id;
  const ownerName = story.profile?.username || story.firebase_display_name || "user";
  const ownerAvatar = story.profile?.avatar_url || story.firebase_photo_url;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-50"
              style={{
                width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <img
            src={profileAvatar(ownerAvatar, ownerId, ownerName)}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="text-sm font-semibold text-white">{ownerName}</span>
          <span className="text-xs text-white/60">{getTimeAgo(story.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"}>
            {paused ? <Play className="h-5 w-5 text-white" /> : <Pause className="h-5 w-5 text-white" />}
          </button>
          <button onClick={onClose}><X className="h-6 w-6 text-white" /></button>
        </div>
      </div>

      {/* Media */}
      {isYouTube ? (
        <div className="relative flex h-full w-full items-center justify-center bg-black">
          <YouTubeEmbedFrame url={story.image_url} title="YouTube story" className="aspect-video w-full max-w-5xl" autoplay={!paused} />
        </div>
      ) : isVideo ? (
        <video
          key={story.id}
          ref={videoRef}
          src={story.image_url}
          className="max-h-full max-w-full"
          autoPlay
          playsInline
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
          }}
          onEnded={goNext}
        />
      ) : (
        <img src={story.image_url} alt="" className="max-h-full max-w-full object-contain" />
      )}

      {/* Music player */}
      {story.music_url && (
        <div key={`m-${story.id}`} className="absolute bottom-6 left-4 right-4 z-20">
          <div className="rounded-lg bg-black/60 backdrop-blur-md px-3 py-2">
            <YouTubeAudio url={story.music_url} title={story.music_title || "Original Audio"} />
          </div>
        </div>
      )}

      {/* Tap zones */}
      {!isYouTube && (
        <>
          <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" aria-label="Previous" />
          <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-1/3 z-10" aria-label="Next" />
        </>
      )}
    </div>
  );
}
