import { useState } from "react";
import { Volume2, VolumeX, Gauge, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ReelItem } from "@/components/ReelItem";
import { ShareSheet } from "@/components/ShareSheet";
import { profileAvatar } from "@/lib/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { filterVisibleMediaRows } from "@/lib/visibility";

const SHORTS_RE = /youtube\.com\/shorts\/([\w-]{11})/;

const Shorts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [shareItem, setShareItem] = useState<any | null>(null);

  const { data: shorts = [], refetch } = useQuery({
    queryKey: ["shorts-feed", user?.id],
    staleTime: 5_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      const onlyShorts = (await filterVisibleMediaRows((data || []) as any[], user)).filter((r: any) => SHORTS_RE.test(r.video_url));
      if (onlyShorts.length === 0) return [];
      const userIds = [...new Set(onlyShorts.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", userIds);
      return onlyShorts.map((r: any) => ({
        ...r,
        username: profiles?.find((p: any) => p.user_id === r.user_id)?.username || "user",
        avatar: profileAvatar(
          profiles?.find((p: any) => p.user_id === r.user_id)?.avatar_url,
          r.user_id,
          profiles?.find((p: any) => p.user_id === r.user_id)?.username
        ),
      }));
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="relative mx-auto max-w-lg">
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur">
          <h1 className="text-xl font-bold text-foreground inline-flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary fill-primary" />
            Shorts
          </h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 text-foreground text-xs font-semibold rounded-full bg-secondary px-2 py-1"
              >
                <Gauge className="h-4 w-4" /> {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 top-9 z-50 rounded-lg bg-popover border border-border shadow-lg py-1 min-w-[80px]">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                      className={`block w-full px-3 py-1.5 text-left text-xs ${speed === s ? "text-primary font-bold" : "text-foreground"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setMuted(!muted)} className="text-foreground" aria-label="Toggle sound">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 text-primary" />}
            </button>
          </div>
        </div>

        {shorts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground px-6 text-center">
            <Zap className="h-14 w-14 mb-3" strokeWidth={1} />
            <p className="text-sm font-semibold text-foreground">No Shorts yet</p>
            <p className="text-xs mt-1">Save a YouTube Shorts URL in your YouTube library and share it as a Reel — it'll show up here.</p>
          </div>
        ) : (
          <div
            className="snap-y snap-mandatory overflow-y-auto pb-16"
            style={{ height: "calc(100vh - 120px)" }}
          >
            {shorts.map((r: any) => (
              <ReelItem
                key={r.id}
                id={r.id}
                userId={r.user_id}
                username={r.username}
                avatar={r.avatar}
                video={r.video_url}
                caption={r.caption || ""}
                music={r.music_title || "Original Audio"}
                musicUrl={r.music_url}
                musicStart={r.music_start}
                musicEnd={r.music_end}
                speed={speed}
                globalMuted={muted}
                onShare={() => setShareItem(r)}
                onRemix={() => navigate("/reels", { state: { remixMusicUrl: r.music_url, remixMusicTitle: r.music_title || "Original Audio" } })}
                onDeleted={() => refetch()}
              />
            ))}
          </div>
        )}
      </div>

      {shareItem && (
        <ShareSheet
          shareUrl={`${window.location.origin}/shorts?id=${shareItem.id}`}
          shareLabel={`⚡ Short by @${shareItem.username}`}
          onClose={() => setShareItem(null)}
        />
      )}
    </div>
  );
};

export default Shorts;
