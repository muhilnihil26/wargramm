import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MusicTrimmer } from "./MusicTrimmer";

interface EditPostModalProps {
  table: "posts" | "reels";
  id: string;
  initial: { caption: string; music_url: string | null; music_title: string | null; music_start: number; music_end: number };
  onClose: () => void;
  onSaved: () => void;
}

/** In-place editor for a post or reel the user owns. Edits caption + background music + trim window. */
export function EditPostModal({ table, id, initial, onClose, onSaved }: EditPostModalProps) {
  const [caption, setCaption] = useState(initial.caption);
  const [musicUrl, setMusicUrl] = useState(initial.music_url || "");
  const [musicTitle, setMusicTitle] = useState(initial.music_title || "");
  const [start, setStart] = useState(initial.music_start);
  const [end, setEnd] = useState(initial.music_end);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update({
        caption,
        music_url: musicUrl || null,
        music_title: musicTitle || null,
        music_start: musicUrl ? start : 0,
        music_end: musicUrl ? end : 30,
      } as any)
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Edit {table === "posts" ? "post" : "reel"}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground" /></button>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption"
          rows={3}
          className="w-full rounded-xl bg-secondary p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
        />
        <input
          value={musicUrl}
          onChange={(e) => { setMusicUrl(e.target.value); setMusicTitle(""); }}
          placeholder="YouTube music URL (optional)"
          className="w-full rounded-xl bg-secondary p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {musicUrl && <MusicTrimmer start={start} end={end} onChange={(a, b) => { setStart(a); setEnd(b); }} />}
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}
