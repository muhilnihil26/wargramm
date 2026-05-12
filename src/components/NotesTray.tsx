import { useEffect, useMemo, useState } from "react";
import { Globe, Lock, MessageCircle, Plus, Users, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { profileAvatar } from "@/lib/avatar";
import { isUuid } from "@/lib/ids";

type Visibility = "public" | "followers" | "only_me";

const visibilityOptions = [
  { v: "public" as const, label: "Everyone", icon: Globe },
  { v: "followers" as const, label: "Followers", icon: Users },
  { v: "only_me" as const, label: "Only me", icon: Lock },
];

const isMissingNotesTable = (error: any) =>
  error?.code === "PGRST205" ||
  error?.code === "42P01" ||
  String(error?.message || "").toLowerCase().includes("public.notes") ||
  String(error?.message || "").toLowerCase().includes("schema cache");

type NotesTrayProps = {
  inline?: boolean;
};

export function NotesTray({ inline = false }: NotesTrayProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [saving, setSaving] = useState(false);
  const localNoteKey = user ? `wargram-local-note:${user.id}` : "";

  const { data: myProfile } = useQuery({
    queryKey: ["notes-profile", user?.id],
    enabled: !!user && isUuid(user.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, is_private")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });
  const ownName = myProfile?.username || user?.displayName || "You";
  const ownAvatar = profileAvatar(myProfile?.avatar_url || user?.photoURL, user?.id, ownName);

  useEffect(() => {
    if (myProfile?.is_private) setVisibility("followers");
  }, [myProfile?.is_private]);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes" as any)
        .select("*")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        if (isMissingNotesTable(error)) {
          const local = localNoteKey ? localStorage.getItem(localNoteKey) : null;
          return local ? [JSON.parse(local)] : [];
        }
        throw error;
      }
      const rows = (data || []) as any[];
      const userIds = [...new Set(rows.map((n) => n.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", userIds)
        : { data: [] as any[] };
      return rows.map((n) => ({
        ...n,
        profile: (profiles as any[])?.find((p) => p.user_id === n.user_id),
      }));
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notes-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user]);

  const mine = useMemo(() => notes.find((n: any) => n.user_id === user?.id), [notes, user?.id]);

  const saveNote = async () => {
    if (!user || !text.trim()) return;
    if (!isUuid(user.id)) {
      const payload = {
        id: `local-${user.id}`,
        user_id: user.id,
        content: text.trim().slice(0, 80),
        visibility,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        profile: myProfile,
      };
      if (localNoteKey) localStorage.setItem(localNoteKey, JSON.stringify(payload));
      setText("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
      toast.success("Note saved");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      content: text.trim().slice(0, 80),
      visibility,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const { error } = mine
      ? await supabase.from("notes" as any).update(payload).eq("id", mine.id)
      : await supabase.from("notes" as any).insert(payload);
    setSaving(false);
    if (error) {
      if (isMissingNotesTable(error)) {
        if (localNoteKey) {
          localStorage.setItem(localNoteKey, JSON.stringify({
            id: `local-${user.id}`,
            user_id: user.id,
            content: payload.content,
            visibility: payload.visibility,
            expires_at: payload.expires_at,
            created_at: new Date().toISOString(),
            profile: myProfile,
          }));
        }
        setText("");
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
        toast.success("Note saved");
        return;
      }
      toast.error(error.message);
      return;
    }
    setText("");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
    toast.success("Note shared");
  };

  const deleteMine = async () => {
    if (!mine || !user) return;
    if (!isUuid(user.id)) {
      if (localNoteKey) localStorage.removeItem(localNoteKey);
      queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
      return;
    }
    const { error } = await supabase.from("notes" as any).delete().eq("id", mine.id);
    if (error) {
      if (isMissingNotesTable(error)) {
        if (localNoteKey) localStorage.removeItem(localNoteKey);
        queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
        return;
      }
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["notes", user.id] });
  };

  const noteBubbles = inline ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setText(mine?.content || "");
        setOpen(true);
      }}
      className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
      aria-label="Your note"
    >
      <span className="relative block max-w-[92px] rounded-[18px] rounded-bl-md bg-background px-2.5 py-1 text-[10px] font-medium leading-tight text-foreground shadow-md ring-1 ring-border">
        {mine?.content || "Note..."}
        <span className="absolute -bottom-1 left-4 h-2 w-2 rounded-full bg-background ring-1 ring-border" />
        <span className="absolute -bottom-3 left-8 h-1.5 w-1.5 rounded-full bg-background ring-1 ring-border" />
      </span>
    </button>
  ) : (
    <>
      <button onClick={() => { setText(mine?.content || ""); setOpen(true); }} className="w-20 shrink-0 text-left">
        <div className="relative mx-auto h-14 w-14">
          <img src={ownAvatar} alt="" className="h-14 w-14 rounded-full object-cover" />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">Your note</p>
      </button>
      {notes.map((note: any) => (
        <div key={note.id} className="w-24 shrink-0">
          <div className="relative mx-auto h-14 w-14">
            <img src={profileAvatar(note.profile?.avatar_url, note.user_id, note.profile?.username)} alt="" className="h-14 w-14 rounded-full object-cover" />
            <div className="absolute -top-2 left-6 max-w-[82px] rounded-[18px] rounded-bl-md bg-secondary px-2.5 py-1 text-[10px] leading-tight text-foreground shadow-sm ring-1 ring-border/70">
              {note.content}
            </div>
          </div>
          <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">{note.profile?.username || "user"}</p>
        </div>
      ))}
    </>
  );

  return (
    <>
      {inline ? noteBubbles : (
        <div className="border-b border-border">
          <div className="mx-auto flex max-w-lg gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
            {noteBubbles}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Leave a note</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="rounded-2xl bg-secondary p-3">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-1 h-5 w-5 text-muted-foreground" />
                <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 80))} rows={3} placeholder="Share a thought..." className="min-h-20 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
              </div>
              <p className="text-right text-[10px] text-muted-foreground">{text.length}/80</p>
            </div>
            <div className="mt-3 flex gap-2">
              {visibilityOptions.map(({ v, label, icon: Icon }) => (
                <button key={v} onClick={() => setVisibility(v)} className={`flex-1 rounded-full border px-2 py-2 text-[11px] font-semibold ${visibility === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground"}`}>
                  <Icon className="mr-1 inline h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              {mine && <button onClick={deleteMine} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground">Delete</button>}
              <button onClick={saveNote} disabled={!text.trim() || saving} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
