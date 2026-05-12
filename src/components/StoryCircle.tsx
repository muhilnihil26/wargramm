import { useState, useRef } from "react";
import { Camera } from "lucide-react";

interface StoryCircleProps {
  username: string;
  avatar: string;
  hasStory?: boolean;
  isOwn?: boolean;
  onClick?: () => void;
}

export function StoryCircle({ username, avatar, hasStory = true, isOwn = false, onClick }: StoryCircleProps) {
  return (
    <button className="flex flex-col items-center gap-1 px-1" onClick={onClick}>
      <div className={`relative rounded-full p-[2px] ${hasStory ? "gradient-story" : "bg-border"}`}>
        <div className="rounded-full border-2 border-background">
          <img
            src={avatar}
            alt={username}
            className="h-16 w-16 rounded-full object-cover"
          />
        </div>
        {isOwn && (
          <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            +
          </div>
        )}
      </div>
      <span className="w-16 truncate text-center text-xs text-foreground">{username}</span>
    </button>
  );
}
