import { useState } from "react";
import { Music, Play, Pause, Plus, X, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isUuid } from "@/lib/ids";

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export function MusicPlayer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { data: tracks = [] } = useQuery({
    queryKey: ["music"],
    queryFn: async () => {
      const { data } = await supabase.from("music").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  const handleAdd = async () => {
    if (!youtubeUrl.trim() || !user) return;
    const videoId = getYouTubeId(youtubeUrl);
    if (!videoId) { toast.error("Invalid YouTube URL"); return; }

    setAdding(true);
    try {
      // Use AI to detect title
      let title = "Unknown Track";
      try {
        const { data, error } = await supabase.functions.invoke("detect-music-title", {
          body: { youtube_url: youtubeUrl },
        });
        if (!error && data?.title) title = data.title;
      } catch {
        // Fallback: extract from URL
        title = `YouTube - ${videoId}`;
      }

      const { error } = await supabase.from("music").insert({
        youtube_url: youtubeUrl.trim(),
        title,
        added_by: isUuid(user.id) ? user.id : null,
      } as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["music"] });
      setYoutubeUrl("");
      setShowAddForm(false);
      toast.success(`Added: ${title}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (tracks.length === 0 && !showAddForm) {
    return (
      <div className="px-4 py-3">
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 text-sm text-primary">
          <Plus className="h-4 w-4" /> Add Music
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      {/* Mini player bar */}
      {playingId && (
        <div className="bg-secondary/50 px-4 py-2">
          {(() => {
            const track = tracks.find((t) => t.id === playingId);
            if (!track) return null;
            const videoId = getYouTubeId(track.youtube_url);
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-foreground truncate">{track.title}</p>
                  </div>
                  <button onClick={() => setPlayingId(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                {videoId && (
                  <div className="rounded-lg overflow-hidden aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Track list header */}
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Music className="h-4 w-4" /> Music
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button onClick={() => setShowAddForm(!showAddForm)} className="text-primary">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type="text"
            placeholder="Paste YouTube URL..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={handleAdd} disabled={adding || !youtubeUrl.trim()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </button>
        </div>
      )}

      {/* Track list */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setPlayingId(playingId === track.id ? null : track.id)}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                playingId === track.id ? "bg-primary/10" : "hover:bg-secondary/50"
              }`}
            >
              <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center shrink-0">
                {playingId === track.id ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="text-sm text-foreground truncate">{track.title}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
