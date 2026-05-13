import { useState, useRef, useEffect } from "react";
import { Sparkles, Users, Music, Film, Image, ArrowLeft, Trash2, Shield, Send, Loader2, BadgeCheck, Check, X as XIcon, Settings as SettingsIcon, Ticket, Plus, Coins, Gift, Megaphone, Ban, Crown, TrendingUp, BadgeDollarSign, ExternalLink, Cloud, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { database } from "@/integrations/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { profileAvatar } from "@/lib/avatar";
import { isConfiguredAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/ids";
import { mediaOwnerAvatar, mediaOwnerId, mediaOwnerName } from "@/lib/firebaseMedia";
import { logCloudAction } from "@/lib/cloudActions";
import { get, ref, remove, set } from "firebase/database";
import { getYouTubeId, youtubeEmbedUrl, youtubeThumbnail } from "@/lib/youtube";
import { deleteFirebaseMedia, readFirebaseMedia } from "@/lib/firebaseUserData";

type Tab = "ai" | "settings" | "users" | "cloud" | "celebrity" | "music" | "posts" | "reels" | "ads" | "verify" | "coupons" | "coins" | "notices" | "blocks";

const QUICK_PROMPTS = [
  "Change primary color to electric purple",
  "Set the app name to 'WarGram Pro' and tagline to 'Built different'",
  "Disable Reels and Stories for everyone",
  "Make the welcome message friendlier",
  "Set max caption length to 1500 and feed page size to 15",
];

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("ai");
  const [previewMedia, setPreviewMedia] = useState<any | null>(null);

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      if (isConfiguredAdmin(user)) return true;
      if (!isUuid(user.id)) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("*");
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: posts }, { data: reels }, { data: stories }, firebaseProfilesSnap] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("posts").select("firebase_uid, firebase_email, firebase_display_name, firebase_photo_url, created_at").not("firebase_uid", "is", null).limit(200),
        supabase.from("reels").select("firebase_uid, firebase_email, firebase_display_name, firebase_photo_url, created_at").not("firebase_uid", "is", null).limit(200),
        supabase.from("stories").select("firebase_uid, firebase_email, firebase_display_name, firebase_photo_url, created_at").not("firebase_uid", "is", null).limit(200),
        get(ref(database, "profiles")).catch(() => null),
      ]);
      const byId = new Map<string, any>();
      (profiles || []).forEach((p: any) => byId.set(p.user_id, p));
      Object.entries(firebaseProfilesSnap?.val?.() || {}).forEach(([uid, profile]: [string, any]) => {
        if (!uid || byId.has(uid)) return;
        byId.set(uid, {
          id: uid,
          user_id: uid,
          firebase_uid: uid,
          username: profile?.username || profile?.email?.split("@")[0] || "firebase_user",
          full_name: profile?.full_name || profile?.email || "",
          avatar_url: profile?.avatar_url || "",
          created_at: profile?.created_at || profile?.updated_at || null,
          is_firebase_user: true,
        });
      });
      [...(posts || []), ...(reels || []), ...(stories || [])].forEach((row: any) => {
        if (!row.firebase_uid || byId.has(row.firebase_uid)) return;
        byId.set(row.firebase_uid, {
          id: row.firebase_uid,
          user_id: row.firebase_uid,
          firebase_uid: row.firebase_uid,
          username: row.firebase_display_name || row.firebase_email?.split("@")[0] || "firebase_user",
          full_name: row.firebase_email || "",
          avatar_url: row.firebase_photo_url || "",
          created_at: row.created_at,
          is_firebase_user: true,
        });
      });
      return [...byId.values()];
    },
    enabled: !!isAdmin,
  });

  const { data: allMusic = [] } = useQuery({
    queryKey: ["admin-music"],
    queryFn: async () => {
      const { data } = await supabase.from("music").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      const firebasePosts = await readFirebaseMedia("post").catch(() => []);
      return [...(data || []), ...firebasePosts].sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
    },
    enabled: !!isAdmin,
  });

  const { data: allReels = [] } = useQuery({
    queryKey: ["admin-reels"],
    queryFn: async () => {
      const { data } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      const firebaseReels = await readFirebaseMedia("reel").catch(() => []);
      return [...(data || []), ...firebaseReels].sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
    },
    enabled: !!isAdmin,
  });

  const { data: allAds = [] } = useQuery({
    queryKey: ["admin-reel-ads"],
    queryFn: async () => {
      const { data } = await supabase.from("reel_ads" as any).select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key)?.value || "";
  const adminUuid = user && isUuid(user.id) ? user.id : null;

  const updateSetting = async (key: string, value: string) => {
    const existing = settings.find((s: any) => s.key === key);
    if (existing) {
      await supabase.from("admin_settings").update({ value } as any).eq("id", existing.id);
    } else {
      await supabase.from("admin_settings").insert({ key, value } as any);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    await logCloudAction(user, "admin_setting_update", { key, value }).catch(() => {});
    toast.success(`Updated ${key}`);
  };

  const deletePost = async (id: string) => {
    const reason = prompt("Reason for removing this post/video:") || "Removed by admin";
    if (!isUuid(id)) {
      await deleteFirebaseMedia("post", id).catch((error) => { throw error; });
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Post deleted");
      return;
    }
    const { error } = await supabase.from("posts").update({ is_removed: true, removed_reason: reason, removed_by: adminUuid, removed_by_firebase_uid: user?.uid || user?.id || null, removed_at: new Date().toISOString() } as any).eq("id", id);
    if (error) {
      const canHardDelete = /is_removed|removed_|schema cache|column/i.test(error.message || "");
      if (!canHardDelete) { toast.error(error.message); return; }
      const fallback = await supabase.from("posts").delete().eq("id", id);
      if (fallback.error) { toast.error(fallback.error.message); return; }
      toast.success("Post deleted");
    } else {
      toast.success("Post removed with reason");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
  };
  const deleteReel = async (id: string) => {
    const reason = prompt("Reason for removing this reel/video:") || "Removed by admin";
    if (!isUuid(id)) {
      await deleteFirebaseMedia("reel", id).catch((error) => { throw error; });
      queryClient.invalidateQueries({ queryKey: ["admin-reels"] });
      queryClient.invalidateQueries({ queryKey: ["reels"] });
      queryClient.invalidateQueries({ queryKey: ["feed-reels"] });
      toast.success("Reel deleted");
      return;
    }
    const { error } = await supabase.from("reels").update({ is_removed: true, removed_reason: reason, removed_by: adminUuid, removed_by_firebase_uid: user?.uid || user?.id || null, removed_at: new Date().toISOString() } as any).eq("id", id);
    if (error) {
      const canHardDelete = /is_removed|removed_|schema cache|column/i.test(error.message || "");
      if (!canHardDelete) { toast.error(error.message); return; }
      const fallback = await supabase.from("reels").delete().eq("id", id);
      if (fallback.error) { toast.error(fallback.error.message); return; }
      toast.success("Reel deleted");
    } else {
      toast.success("Reel removed with reason");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-reels"] });
    queryClient.invalidateQueries({ queryKey: ["reels"] });
    queryClient.invalidateQueries({ queryKey: ["feed-reels"] });
  };
  const deleteMusic = async (id: string) => { await supabase.from("music").delete().eq("id", id); queryClient.invalidateQueries({ queryKey: ["admin-music"] }); toast.success("Track removed"); };

  const deleteUserFromApp = async (target: any) => {
    const targetId = target.user_id || target.firebase_uid || target.id;
    if (!targetId) return;
    if (targetId === "nxANfkUL63MSTv300eH6rSICw9w1" || target.full_name === "muhilsiddhesh.in@gmail.com" || target.email === "muhilsiddhesh.in@gmail.com") {
      toast.error("Admin user cannot be deleted.");
      return;
    }
    if (!confirm(`Remove @${target.username || targetId} from the app? This does not delete Firebase Authentication login.`)) return;
    try {
      const removeFirebaseMediaByOwner = async (path: string) => {
        const snap = await get(ref(database, path)).catch(() => null);
        const rows = snap?.val?.() || {};
        await Promise.all(Object.entries(rows)
          .filter(([, row]: [string, any]) => (row?.firebase_uid || row?.user_id) === targetId)
          .map(([id]) => remove(ref(database, `${path}/${id}`)).catch(() => {})));
      };
      await Promise.all([
        removeFirebaseMediaByOwner("firebasePosts"),
        removeFirebaseMediaByOwner("firebaseReels"),
        removeFirebaseMediaByOwner("firebaseStories"),
        remove(ref(database, `profiles/${targetId}`)).catch(() => {}),
        remove(ref(database, `follows/${targetId}`)).catch(() => {}),
        remove(ref(database, `followers/${targetId}`)).catch(() => {}),
        remove(ref(database, `followRequests/${targetId}`)).catch(() => {}),
        remove(ref(database, `bookmarks/${targetId}`)).catch(() => {}),
        remove(ref(database, `youtubeLibrary/${targetId}`)).catch(() => {}),
        remove(ref(database, `callInvites/${targetId}`)).catch(() => {}),
        remove(ref(database, `pushTokens/${targetId}`)).catch(() => {}),
      ]);
      if (isUuid(targetId)) {
        await Promise.all([
          supabase.from("posts").delete().eq("user_id", targetId),
          supabase.from("reels").delete().eq("user_id", targetId),
          supabase.from("stories").delete().eq("user_id", targetId),
          supabase.from("follows").delete().or(`follower_id.eq.${targetId},following_id.eq.${targetId}`),
          supabase.from("follow_requests").delete().or(`requester_id.eq.${targetId},target_id.eq.${targetId}`),
          supabase.from("notifications").delete().or(`user_id.eq.${targetId},actor_id.eq.${targetId}`),
          supabase.from("user_roles").delete().eq("user_id", targetId),
          supabase.from("profiles").delete().eq("user_id", targetId),
        ]);
      } else {
        await Promise.all([
          supabase.from("posts").delete().eq("firebase_uid", targetId),
          supabase.from("reels").delete().eq("firebase_uid", targetId),
          supabase.from("stories").delete().eq("firebase_uid", targetId),
        ]);
      }
      await logCloudAction(user, "admin_user_delete_app", { target_id: targetId }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reels"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed-reels"] });
      queryClient.invalidateQueries({ queryKey: ["reels"] });
      toast.success("User removed from app data");
    } catch (error: any) {
      toast.error(error?.message || "Could not remove user");
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (!isAdmin) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <Shield className="h-16 w-16 text-muted-foreground" />
      <p className="text-lg text-muted-foreground">Access denied. Admin only.</p>
      <button onClick={() => navigate("/")} className="text-primary text-sm font-semibold">Go Home</button>
    </div>
  );

  const tabs = [
    { id: "ai" as Tab, icon: Sparkles, label: "AI Editor" },
    { id: "settings" as Tab, icon: SettingsIcon, label: "Settings" },
    { id: "verify" as Tab, icon: BadgeCheck, label: "Verify" },
    { id: "coupons" as Tab, icon: Ticket, label: "Coupons" },
    { id: "coins" as Tab, icon: Coins, label: "Coins" },
    { id: "notices" as Tab, icon: Megaphone, label: "Notices" },
    { id: "blocks" as Tab, icon: Ban, label: "Blocks" },
    { id: "cloud" as Tab, icon: Cloud, label: "Cloud" },
    { id: "users" as Tab, icon: Users, label: "Users" },
    { id: "celebrity" as Tab, icon: Crown, label: "Stars" },
    { id: "music" as Tab, icon: Music, label: "Music" },
    { id: "posts" as Tab, icon: Image, label: "Posts" },
    { id: "reels" as Tab, icon: Film, label: "Reels" },
    { id: "ads" as Tab, icon: BadgeDollarSign, label: "Ads" },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate("/")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 p-3 lg:grid-cols-[220px_1fr]">
        <aside className="overflow-x-auto rounded-2xl border border-border bg-secondary/35 p-2 lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="flex gap-1 lg:flex-col">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`min-w-[84px] rounded-xl flex items-center justify-center lg:justify-start gap-2 py-2.5 px-3 text-xs font-semibold transition-colors ${activeTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}>
                <t.icon className="h-4 w-4" strokeWidth={1.8} />
                {t.label}
              </button>
            ))}
          </div>
        </aside>

      <main className="min-w-0 space-y-4">
        {activeTab === "ai" && (
          <AiEditor settings={settings} onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
            queryClient.invalidateQueries({ queryKey: ["app-settings"] });
          }} />
        )}

        {activeTab === "settings" && (
          <SettingsPanel getSetting={getSetting} updateSetting={updateSetting} />
        )}

        {activeTab === "users" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{allUsers.length} users</p>
            {allUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <img src={profileAvatar(u.avatar_url, u.user_id, u.username)} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.username || "unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{u.full_name}</p>
                </div>
                <button
                  onClick={() => deleteUserFromApp(u)}
                  className="rounded-lg p-2 text-destructive hover:bg-background"
                  aria-label="Delete user from app"
                  title="Delete user from app"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "cloud" && (
          <FirebaseCloudMigration adminId={user!.id} />
        )}

        {activeTab === "celebrity" && (
          <CelebrityAdmin users={allUsers} onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["explore-celebrities"] });
          }} />
        )}

        {activeTab === "music" && (
          <div className="space-y-3">
            <AddMusicForm onAdded={() => queryClient.invalidateQueries({ queryKey: ["admin-music"] })} adminId={user!.id} />
            <p className="text-sm text-muted-foreground">{allMusic.length} tracks</p>
            {allMusic.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <Music className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{m.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.youtube_url}</p>
                </div>
                <button onClick={() => deleteMusic(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "posts" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{allPosts.length} posts</p>
            {allPosts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <button onClick={() => setPreviewMedia({ type: "post", url: p.image_url, isVideo: p.is_video, title: p.caption || "Post" })} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
                  <AdminMediaThumb url={p.image_url} isVideo={p.is_video} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{mediaOwnerName(p)}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.caption || "No caption"}</p>
                  {p.is_removed && <p className="text-[11px] text-destructive truncate">Removed: {p.removed_reason || "No reason"}</p>}
                </div>
                <button onClick={() => setPreviewMedia({ type: "post", url: p.image_url, isVideo: p.is_video, title: p.caption || "Post" })} className="rounded-lg p-2 text-primary hover:bg-background" aria-label="Preview post">
                  <Eye className="h-4 w-4" />
                </button>
                {!p.is_removed && <button onClick={() => deletePost(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>}
              </div>
            ))}
          </div>
        )}

        {activeTab === "reels" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{allReels.length} reels</p>
            {allReels.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <button onClick={() => setPreviewMedia({ type: "reel", url: r.video_url, isVideo: true, title: r.caption || "Reel" })} className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
                  <AdminMediaThumb url={r.video_url} isVideo />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.caption || "No caption"}</p>
                  <p className="text-xs text-muted-foreground truncate">{mediaOwnerName(r)}</p>
                  {r.is_removed && <p className="text-[11px] text-destructive truncate">Removed: {r.removed_reason || "No reason"}</p>}
                </div>
                <button onClick={() => setPreviewMedia({ type: "reel", url: r.video_url, isVideo: true, title: r.caption || "Reel" })} className="rounded-lg p-2 text-primary hover:bg-background" aria-label="Preview reel">
                  <Eye className="h-4 w-4" />
                </button>
                {!r.is_removed && <button onClick={() => deleteReel(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>}
              </div>
            ))}
          </div>
        )}

        {activeTab === "ads" && (
          <ReelAdsAdmin
            ads={allAds}
            adminId={user!.id}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-reel-ads"] });
              queryClient.invalidateQueries({ queryKey: ["reel-ads"] });
            }}
          />
        )}

        {activeTab === "verify" && <VerificationReview />}

        {activeTab === "coupons" && <CouponsAdmin />}

        {activeTab === "coins" && <CoinGiveaway users={allUsers} />}

        {activeTab === "notices" && <NoticesAdmin adminId={user!.id} />}

        {activeTab === "blocks" && <BlocksAdmin users={allUsers} adminId={user!.id} /> }
      </main>
      </div>
      {previewMedia && <AdminMediaPreview media={previewMedia} onClose={() => setPreviewMedia(null)} />}
    </div>
  );
};

function CoinGiveaway({ users }: { users: any[] }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("admin_giveaway");
  const [targetMode, setTargetMode] = useState<"all" | "user">("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const cloudUsers = users.filter((u) => isUuid(u.user_id));
  const filtered = !search.trim()
    ? []
    : users
        .filter((u) => (u.username || "").toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8);

  const grant = async () => {
    if (!amount || amount === 0) { toast.error("Amount must be non-zero"); return; }
    if (targetMode === "user" && !selectedUser) { toast.error("Pick a user"); return; }
    if (targetMode === "user" && !isUuid(selectedUser.user_id)) { toast.error("Coins need a Supabase UUID profile. Firebase-only users can use local rewards after profile sync."); return; }
    if (targetMode === "all" && !confirm(`Give ${amount} coins to ALL users?`)) return;
    setLoading(true);
    try {
      const args: any = { _admin_uid: user?.uid || user?.id || "", _amount: amount, _reason: reason || "admin_grant" };
      if (targetMode === "user") args._target_user = selectedUser.user_id;
      const { data, error } = await supabase.rpc("admin_grant_coins_client" as any, args);
      if (error) throw error;
      toast.success(`Granted ${amount} coins to ${targetMode === "all" ? `${data ?? "all"} users` : "@" + selectedUser.username}`);
      setSelectedUser(null);
      setSearch("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to grant coins. Are you signed in as admin?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-secondary p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <p className="text-sm font-bold text-foreground">Coin giveaway</p>
        </div>
        <p className="text-xs text-muted-foreground">Reward cloud profiles. Firebase-only users are shown, but coins require profile sync.</p>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTargetMode("all")} className={`rounded-lg py-2 text-xs font-semibold ${targetMode === "all" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}>
            🎉 All users
          </button>
          <button onClick={() => setTargetMode("user")} className={`rounded-lg py-2 text-xs font-semibold ${targetMode === "user" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}>
            👤 One user
          </button>
        </div>

        {targetMode === "user" && (
          <div className="space-y-2">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
              placeholder="Search username…"
              className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
            {selectedUser && (
              <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                <img src={profileAvatar(selectedUser.avatar_url, selectedUser.user_id, selectedUser.username)} alt="" className="h-8 w-8 rounded-full object-cover" />
                <p className="text-sm text-foreground flex-1">@{selectedUser.username}</p>
                <button onClick={() => setSelectedUser(null)}><XIcon className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            )}
            {!selectedUser && filtered.map((u) => (
              <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(u.username); }} className="flex items-center gap-2 w-full rounded-lg bg-background p-2 hover:bg-secondary">
                <img src={profileAvatar(u.avatar_url, u.user_id, u.username)} alt="" className="h-8 w-8 rounded-full object-cover" />
                <p className="text-sm text-foreground">@{u.username}</p>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Coins
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
          </label>
          <label className="text-xs text-muted-foreground">Reason tag
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
          </label>
        </div>

        <button onClick={grant} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <Coins className="h-4 w-4" /> {loading ? "Granting…" : targetMode === "all" ? `Send ${amount} coins to everyone` : `Send ${amount} coins`}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">Tip: use a negative amount to deduct coins. Cloud coin users: {cloudUsers.length}/{users.length}.</p>
    </div>
  );
}

function CelebrityAdmin({ users, onChanged }: { users: any[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const sorted = [...users]
    .filter((u) => !search.trim() || `${u.username || ""} ${u.full_name || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(!!b.is_celebrity) - Number(!!a.is_celebrity) || (b.celebrity_score || 0) - (a.celebrity_score || 0))
    .slice(0, 80);

  const setCelebrity = async (u: any, next: boolean) => {
    if (!isUuid(u.user_id)) { toast.error("Celebrity badges need a synced Supabase profile for this Firebase user."); return; }
    setSaving(u.user_id);
    const score = Number(u.celebrity_score || 0);
    const { error } = await supabase
      .from("profiles")
      .update({ is_celebrity: next, celebrity_score: next ? Math.max(score, 100) : 0 } as any)
      .eq("user_id", u.user_id);
    setSaving(null);
    if (error) {
      toast.error("Apply the celebrity migration first, then try again.");
      return;
    }
    toast.success(next ? `@${u.username || "user"} marked as celebrity` : `@${u.username || "user"} removed from celebrities`);
    onChanged();
  };

  const updateScore = async (u: any, score: number) => {
    if (!isUuid(u.user_id)) { toast.error("Celebrity score needs a synced Supabase profile."); return; }
    setSaving(u.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ celebrity_score: Math.max(0, score), is_celebrity: score > 0 ? true : !!u.is_celebrity } as any)
      .eq("user_id", u.user_id);
    setSaving(null);
    if (error) {
      toast.error("Apply the celebrity migration first, then try again.");
      return;
    }
    toast.success("Celebrity score updated");
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-secondary p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <p className="text-sm font-bold text-foreground">Celebrity users</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Pick high-view, high-like, or important accounts. They appear in Explore as featured celebrities.</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="mt-3 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none"
        />
      </div>

      {sorted.map((u: any) => (
        <div key={u.user_id} className="rounded-xl bg-secondary p-3">
          <div className="flex items-center gap-3">
            <img src={profileAvatar(u.avatar_url, u.user_id, u.username)} alt="" className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                {u.username || "unnamed"}
                {u.is_celebrity && <Crown className="h-3.5 w-3.5 fill-primary text-primary" />}
              </p>
              <p className="truncate text-xs text-muted-foreground">{u.full_name || "No full name"}</p>
            </div>
            <button
              onClick={() => setCelebrity(u, !u.is_celebrity)}
              disabled={saving === u.user_id}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${u.is_celebrity ? "bg-background text-foreground" : "bg-primary text-primary-foreground"}`}
            >
              {u.is_celebrity ? "Remove" : "Make star"}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              defaultValue={u.celebrity_score || 0}
              onBlur={(e) => updateScore(u, Number(e.target.value))}
              className="w-24 rounded-lg bg-background px-2 py-1 text-xs text-foreground outline-none"
            />
            <span className="text-[11px] text-muted-foreground">score, higher appears first</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CouponsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [cost, setCost] = useState(100);
  const [stock, setStock] = useState(50);
  const [saving, setSaving] = useState(false);

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const create = async () => {
    if (!title.trim() || !code.trim()) { toast.error("Title and code required"); return; }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      title: title.trim(),
      brand: brand.trim() || null,
      description: description.trim() || null,
      code: code.trim(),
      cost_coins: cost,
      stock,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Coupon added");
    setTitle(""); setBrand(""); setDescription(""); setCode(""); setCost(100); setStock(50);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    qc.invalidateQueries({ queryKey: ["coupons"] });
  };

  const remove = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    toast.success("Coupon removed");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-secondary p-3 space-y-2">
        <p className="text-sm font-bold text-foreground">New coupon</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. 10% off Nike)" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code (e.g. WAR10)" className="w-full rounded-lg bg-background px-3 py-2 text-sm font-mono text-foreground outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Cost (coins)
            <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
          </label>
          <label className="text-xs text-muted-foreground">Stock
            <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
          </label>
        </div>
        <button onClick={create} disabled={saving} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1">
          <Plus className="h-4 w-4" /> {saving ? "Adding…" : "Add coupon"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">{coupons.length} coupon(s)</p>
      {coupons.map((c: any) => (
        <div key={c.id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
          <Ticket className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
            <p className="text-[11px] text-muted-foreground">{c.cost_coins} coins · {c.stock} left · code <span className="font-mono">{c.code}</span></p>
          </div>
          <button onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
        </div>
      ))}
    </div>
  );
}

function VerificationReview() {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return [];
      const ids = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
      return data.map((r: any) => ({ ...r, profile: profiles?.find((p: any) => p.user_id === r.user_id) }));
    },
  });

  const decide = async (req: any, approve: boolean) => {
    const note = approve ? null : prompt("Reason for rejection (optional):") || null;
    await supabase.from("verification_requests").update({
      status: approve ? "approved" : "rejected",
      admin_note: note,
      reviewed_at: new Date().toISOString(),
    } as any).eq("id", req.id);
    await supabase.from("profiles").update({
      is_verified: approve,
      verification_status: approve ? "approved" : "rejected",
    } as any).eq("user_id", req.user_id);
    toast.success(approve ? "User verified" : "Request rejected");
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{requests.length} request(s)</p>
      {requests.length === 0 && <p className="text-xs text-muted-foreground italic">No verification requests yet.</p>}
      {requests.map((r: any) => (
        <div key={r.id} className="rounded-xl bg-secondary p-3 space-y-2">
          <div className="flex items-center gap-3">
            <img src={profileAvatar(r.profile?.avatar_url, r.user_id, r.profile?.username)} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{r.profile?.username || "user"}</p>
              <p className="text-xs text-muted-foreground truncate">{r.full_legal_name} · {r.category}</p>
            </div>
            <span className={`text-[10px] uppercase font-bold ${r.status === "approved" ? "text-primary" : r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>{r.status}</span>
          </div>
          {r.reason && <p className="text-xs text-foreground/80">"{r.reason}"</p>}
          <div className="flex gap-2">
            {r.document_url && <a href={r.document_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">View ID</a>}
            {r.selfie_url && <a href={r.selfie_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">View selfie</a>}
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => decide(r, true)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground">
                <Check className="h-3 w-3" /> Approve
              </button>
              <button onClick={() => decide(r, false)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-destructive-foreground">
                <XIcon className="h-3 w-3" /> Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type ChatMsg = { role: "user" | "assistant"; content: string; applied?: { key: string; value: string }[] };

function AiEditor({ settings, onApplied }: { settings: any[]; onApplied: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm your admin assistant. Tell me what you want to change — colors, copy, feature flags, anything. I'll apply it instantly." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-ai", {
        body: { messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        const summary = data?.summary || "Done.";
        const applied = data?.applied || [];
        setMessages((p) => [...p, { role: "assistant", content: summary, applied }]);
        if (applied.length > 0) { onApplied(); toast.success(`Applied ${applied.length} change(s)`); }
      }
    } catch (e: any) {
      const applied = await applyBuiltInAdminAI(text, user).catch(() => []);
      if (applied.length > 0) {
        onApplied();
        toast.success(`Applied ${applied.length} change(s)`);
        setMessages((p) => [...p, { role: "assistant", content: "I applied these changes with the built-in admin AI fallback.", applied }]);
        setSending(false);
        return;
      }
      toast.error(e.message || "Failed to reach AI");
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Could not reach the AI. Try again." }]);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-secondary/40 border border-border p-3 space-y-3 max-h-[55vh] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background text-foreground rounded-bl-sm border border-border"}`}>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.applied && m.applied.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                  {m.applied.map((a, j) => (
                    <div key={j} className="text-[11px] text-muted-foreground"><span className="text-foreground font-mono">{a.key}</span> = <span className="font-mono">{a.value.length > 40 ? a.value.slice(0, 40) + "…" : a.value}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} onClick={() => send(q)} disabled={sending}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] text-foreground hover:bg-secondary/70 disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Tell the AI what to change…"
          className="flex-1 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none" />
        <button onClick={() => send(input)} disabled={!input.trim() || sending}
          className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <button onClick={() => setShowSettings((s) => !s)} className="text-xs text-muted-foreground underline">
        {showSettings ? "Hide" : "Show"} current settings ({settings.length})
      </button>
      {showSettings && (
        <div className="rounded-xl bg-secondary p-3 space-y-1 max-h-60 overflow-y-auto">
          {settings.length === 0 && <p className="text-xs text-muted-foreground italic">No settings yet</p>}
          {settings.map((s: any) => (
            <div key={s.id} className="text-[11px] font-mono text-foreground break-all">
              <span className="text-primary">{s.key}</span> = {s.value || <span className="italic text-muted-foreground">empty</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function applyBuiltInAdminAI(text: string, user: any) {
  const lower = text.toLowerCase();
  const changes: { key: string; value: string }[] = [];
  const add = (key: string, value: string) => changes.push({ key, value });
  const quoted = text.match(/['"]([^'"]+)['"]/)?.[1];
  const number = text.match(/\b(\d{1,5})\b/)?.[1];
  const hex = text.match(/#[0-9a-fA-F]{6}\b/)?.[0];

  if (lower.includes("enable reels") || lower.includes("reels true")) add("feature_reels", "true");
  if (lower.includes("disable reels") || lower.includes("reels false")) add("feature_reels", "false");
  if (lower.includes("enable stories") || lower.includes("stories true")) add("feature_stories", "true");
  if (lower.includes("disable stories") || lower.includes("stories false")) add("feature_stories", "false");
  if (lower.includes("enable messages") || lower.includes("enable dms")) add("feature_dms", "true");
  if (lower.includes("disable messages") || lower.includes("disable dms")) add("feature_dms", "false");
  if (lower.includes("enable youtube")) add("feature_youtube", "true");
  if (lower.includes("disable youtube")) add("feature_youtube", "false");
  if (lower.includes("enable ads")) add("reel_ads_enabled", "true");
  if (lower.includes("disable ads")) add("reel_ads_enabled", "false");
  if ((lower.includes("app name") || lower.includes("rename")) && quoted) add("app_name", quoted);
  if (lower.includes("welcome") && quoted) add("welcome_message", quoted);
  if (lower.includes("copyright") && quoted) add("reels_copyright_notice", quoted);
  if ((lower.includes("primary color") || lower.includes("theme color")) && hex) add("primary_color", hex);
  if (lower.includes("feed") && lower.includes("size") && number) add("feed_page_size", number);
  if (lower.includes("caption") && lower.includes("length") && number) add("max_caption_length", number);

  if (changes.length === 0) return [];
  for (const change of changes) {
    const { data: existing } = await supabase.from("admin_settings").select("id").eq("key", change.key).maybeSingle();
    if (existing?.id) await supabase.from("admin_settings").update({ value: change.value } as any).eq("id", existing.id);
    else await supabase.from("admin_settings").insert({ key: change.key, value: change.value } as any);
  }
  await logCloudAction(user, "admin_ai_settings_update", { changes }).catch(() => {});
  return changes;
}

function AddMusicForm({ adminId, onAdded }: { adminId: string; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setSaving(true);
    let resolvedTitle = title.trim();
    if (!resolvedTitle) {
      try {
        const { data } = await supabase.functions.invoke("detect-music-title", { body: { url } });
        resolvedTitle = data?.title || "Untitled";
      } catch { resolvedTitle = "Untitled"; }
    }
    const { error } = await supabase.from("music").insert({ youtube_url: url.trim(), title: resolvedTitle, added_by: isUuid(adminId) ? adminId : null } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setUrl(""); setTitle("");
    toast.success("Track added");
    onAdded();
  };

  return (
    <div className="rounded-xl bg-secondary p-4 space-y-2">
      <p className="text-xs font-semibold text-foreground">Add a YouTube track</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional — auto-detected)" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
      <button onClick={submit} disabled={!url.trim() || saving} className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
        {saving ? "Adding…" : "Add track"}
      </button>
    </div>
  );
}

function SettingsPanel({ getSetting, updateSetting }: { getSetting: (k: string) => string; updateSetting: (k: string, v: string) => Promise<void> }) {
  const fields: { key: string; label: string; placeholder: string; help?: string }[] = [
    {
      key: "auth_redirect_url",
      label: "Auth redirect URL",
      placeholder: `${window.location.origin}/`,
      help: "Where users land after confirming email or resetting password. Leave blank to use the current site origin.",
    },
    { key: "app_name", label: "App name", placeholder: "WarGram", help: "Used in the document title and some headings." },
    { key: "welcome_message", label: "Welcome message", placeholder: "Welcome to WarGram", help: "Shown on the auth screen." },
    { key: "reels_copyright_notice", label: "Reels copyright notice", placeholder: "Copyrighted or harmful videos may be removed by admin.", help: "Shown around reels and ads as the copyright warning." },
    { key: "reel_ads_enabled", label: "Show ads in Reels", placeholder: "true", help: "Use true or false. Ads are stored in the cloud and shown between reels." },
    { key: "feature_reels", label: "Reels enabled", placeholder: "true", help: "Use true or false. Controls the Reels tab and route." },
    { key: "feature_stories", label: "Stories enabled", placeholder: "true", help: "Use true or false. Controls story creation and viewing." },
    { key: "feature_dms", label: "Messages enabled", placeholder: "true", help: "Use true or false. Controls direct messages." },
    { key: "feature_youtube", label: "YouTube library enabled", placeholder: "true", help: "Use true or false. Controls the YouTube library page." },
    { key: "feed_page_size", label: "Feed page size", placeholder: "30", help: "Number of posts to load in feed." },
    { key: "max_caption_length", label: "Max caption length", placeholder: "2200", help: "Maximum caption length for posts and reels." },
  ];

  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, getSetting(f.key)])));
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Re-sync when settings load in
  useEffect(() => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, getSetting(f.key)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => getSetting(f.key)).join("|")]);

  const save = async (key: string) => {
    setSavingKey(key);
    try { await updateSetting(key, draft[key] || ""); } finally { setSavingKey(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        These settings are stored in <span className="font-mono">admin_settings</span> and applied app-wide.
      </p>
      {fields.map((f) => (
        <div key={f.key} className="rounded-xl bg-secondary p-3 space-y-2">
          <label className="text-xs font-semibold text-foreground">{f.label}</label>
          <input
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none"
          />
          {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
          <button
            onClick={() => save(f.key)}
            disabled={savingKey === f.key}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {savingKey === f.key ? "Saving…" : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
}

export default Admin;

function FirebaseCloudMigration({ adminId }: { adminId: string }) {
  const [running, setRunning] = useState(false);
  const [factoryRunning, setFactoryRunning] = useState(false);
  const isHardcodedAdmin = adminId === "nxANfkUL63MSTv300eH6rSICw9w1";

  const runCleanup = async () => {
    if (!isHardcodedAdmin) {
      toast.error("Only the configured Firebase admin can run this migration.");
      return;
    }
    if (!confirm("This deletes Firebase cloud posts/reels, likes/comments for those media, and removes app profile mirrors except admin. Continue?")) return;
    setRunning(true);
    try {
      await Promise.all([
        remove(ref(database, "firebasePosts")),
        remove(ref(database, "firebaseReels")),
        remove(ref(database, "postLikes")),
        remove(ref(database, "reelLikes")),
        remove(ref(database, "postComments")),
        remove(ref(database, "reelComments")),
      ]);

      const profilesSnap = await get(ref(database, "profiles"));
      const profiles = profilesSnap.val() || {};
      const removals = Object.entries(profiles)
        .filter(([uid, profile]: [string, any]) => uid !== "nxANfkUL63MSTv300eH6rSICw9w1" && profile?.email !== "muhilsiddhesh.in@gmail.com")
        .map(([uid]) => remove(ref(database, `profiles/${uid}`)));
      await Promise.all(removals);
      await logCloudAction({ id: adminId, uid: adminId } as any, "admin_firebase_cloud_cleanup", { removed_profiles: removals.length }).catch(() => {});
      toast.success(`Firebase cloud cleaned. Removed ${removals.length} profile mirrors.`);
    } catch (error: any) {
      toast.error(error?.message || "Firebase cleanup failed. Deploy database rules first.");
    } finally {
      setRunning(false);
    }
  };

  const runFactoryClear = async () => {
    if (!isHardcodedAdmin) {
      toast.error("Only the configured Firebase admin can run this cleanup.");
      return;
    }
    const phrase = prompt("Type CLEAR to delete all app users, posts, reels, stories, follows, chats, notifications, and saved data. The admin login/password is not deleted.");
    if (phrase !== "CLEAR") return;
    setFactoryRunning(true);
    try {
      const adminProfileSnap = await get(ref(database, `profiles/${adminId}`)).catch(() => null);
      const adminProfile = adminProfileSnap?.val?.() || {
        username: "muhilsiddhesh",
        full_name: "Muhil Siddhesh",
        email: "muhilsiddhesh.in@gmail.com",
        firebase_uid: adminId,
        is_admin: true,
      };

      await Promise.all([
        remove(ref(database, "firebasePosts")),
        remove(ref(database, "firebaseReels")),
        remove(ref(database, "firebaseStories")),
        remove(ref(database, "postLikes")),
        remove(ref(database, "reelLikes")),
        remove(ref(database, "postComments")),
        remove(ref(database, "reelComments")),
        remove(ref(database, "profiles")),
        remove(ref(database, "follows")),
        remove(ref(database, "followers")),
        remove(ref(database, "followRequests")),
        remove(ref(database, "bookmarks")),
        remove(ref(database, "youtubeLibrary")),
        remove(ref(database, "callInvites")),
        remove(ref(database, "pushTokens")),
        remove(ref(database, "firebaseNotifications")),
        remove(ref(database, "rooms")),
        remove(ref(database, "messages")),
        remove(ref(database, "calls")),
      ]);
      await set(ref(database, `profiles/${adminId}`), {
        ...adminProfile,
        email: adminProfile.email || "muhilsiddhesh.in@gmail.com",
        firebase_uid: adminId,
        is_admin: true,
        updated_at: Date.now(),
      });

      await Promise.all([
        supabase.from("message_reactions" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("comments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("reel_comments" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("likes").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("reel_likes").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("saved_posts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("posts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("reels").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("stories").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("follow_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("follows").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("youtube_library" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("youtube_library_client" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("profiles").delete().neq("email", "muhilsiddhesh.in@gmail.com"),
      ]);

      Object.keys(localStorage)
        .filter((key) => key.startsWith("wargram-"))
        .forEach((key) => {
          if (["wargram-theme", "wargram-ringtone", "wargram-web-push-enabled", "wargram-web-push-asked"].includes(key)) return;
          localStorage.removeItem(key);
        });

      await logCloudAction({ id: adminId, uid: adminId } as any, "admin_factory_clear_keep_admin", { kept_admin: adminId }).catch(() => {});
      toast.success("App data cleared. Admin account was kept; all media was removed.");
      setTimeout(() => window.location.reload(), 700);
    } catch (error: any) {
      toast.error(error?.message || "Cleanup failed. Check Firebase rules and Supabase policies.");
    } finally {
      setFactoryRunning(false);
    }
  };

  const clearThisDeviceCache = () => {
    if (!confirm("Clear old local WarGram cache on this browser? This removes local fallback posts/reels/chats/saves from this device only.")) return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith("wargram-"))
      .forEach((key) => {
        if (["wargram-theme", "wargram-ringtone", "wargram-web-push-enabled", "wargram-web-push-asked"].includes(key)) return;
        localStorage.removeItem(key);
      });
    toast.success("This device cache was cleared. Refreshing...");
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Firebase cloud migration</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this when Supabase media sync is blocked. It keeps Firebase as backup cloud storage for posts, reels, stories, and YouTube library.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-background p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Cleanup action:</p>
          <p>Deletes Firebase posts, reels, post/reel likes, post/reel comments, and app profile mirrors except the admin account.</p>
          <p className="mt-2">Admin kept: muhilsiddhesh.in@gmail.com / nxANfkUL63MSTv300eH6rSICw9w1</p>
        </div>
        <button
          onClick={runCleanup}
          disabled={running || !isHardcodedAdmin}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {running ? "Cleaning Firebase..." : "Clean Firebase Cloud"}
        </button>
        {!isHardcodedAdmin && (
          <p className="mt-2 text-[11px] text-muted-foreground">Sign in as the configured Firebase admin to enable this.</p>
        )}
      </div>
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        <h2 className="text-sm font-bold text-foreground">Factory clear app data</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deletes all app users, posts, reels, stories, follows, chats, saved data, notifications, and YouTube library data. Keeps only the configured admin profile. Admin login/password cannot be deleted from the client app.
        </p>
        <button
          onClick={runFactoryClear}
          disabled={factoryRunning || !isHardcodedAdmin}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50"
        >
          {factoryRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {factoryRunning ? "Clearing app..." : "Clear Everything Except Admin"}
        </button>
        {!isHardcodedAdmin && (
          <p className="mt-2 text-[11px] text-muted-foreground">Sign in as nxANfkUL63MSTv300eH6rSICw9w1 to enable this action.</p>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <h2 className="text-sm font-bold text-foreground">Clear this browser cache</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Use this if old fallback posts, reels, chats, or saved users still appear on this device after cloud cleanup.
        </p>
        <button
          onClick={clearThisDeviceCache}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-foreground ring-1 ring-border"
        >
          <Trash2 className="h-4 w-4" />
          Clear This Device Cache
        </button>
      </div>
    </div>
  );
}

function AdminMediaThumb({ url, isVideo }: { url?: string | null; isVideo?: boolean }) {
  const ytThumb = url ? youtubeThumbnail(url) : null;
  if (ytThumb) return <img src={ytThumb} alt="" className="h-full w-full object-cover" />;
  if (isVideo && url) return <video src={url} className="h-full w-full object-cover" muted preload="metadata" />;
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Film className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

function AdminMediaPreview({ media, onClose }: { media: any; onClose: () => void }) {
  const youtubeId = getYouTubeId(media.url || "");
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-background" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{media.title || "Preview"}</p>
            <p className="text-[11px] uppercase text-muted-foreground">{media.type}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary" aria-label="Close preview">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-black">
          {youtubeId ? (
            <div className="aspect-video w-full">
              <iframe src={youtubeEmbedUrl(media.url)} title="Admin media preview" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          ) : media.isVideo ? (
            <video src={media.url} className="max-h-[75vh] w-full bg-black object-contain" controls autoPlay />
          ) : (
            <img src={media.url} alt="" className="max-h-[75vh] w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

function ReelAdsAdmin({ ads, adminId, onChanged }: { ads: any[]; adminId: string; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!title.trim()) { toast.error("Add an ad title"); return; }
    setSaving(true);
    const { error } = await supabase.from("reel_ads" as any).insert({
      title: title.trim(),
      body: body.trim() || null,
      image_url: imageUrl.trim() || null,
      target_url: targetUrl.trim() || null,
      active: true,
      created_by: isUuid(adminId) ? adminId : null,
      created_by_firebase_uid: adminId,
    });
    setSaving(false);
    if (error) { toast.error("Apply the ads migration first, then try again."); return; }
    setTitle(""); setBody(""); setImageUrl(""); setTargetUrl("");
    toast.success("Ad added");
    onChanged();
  };

  const toggle = async (ad: any) => {
    const { error } = await supabase.from("reel_ads" as any).update({ active: !ad.active }).eq("id", ad.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("reel_ads" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ad removed");
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-secondary/40 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Add reel ad</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ad title" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ad text" rows={2} className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL optional" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="Click URL optional" className="w-full rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none" />
        <button onClick={add} disabled={saving || !title.trim()} className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {saving ? "Adding..." : "Add ad"}
        </button>
      </div>
      {ads.map((ad: any) => (
        <div key={ad.id} className="rounded-xl bg-secondary p-3">
          <div className="flex items-start gap-3">
            {ad.image_url ? <img src={ad.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <BadgeDollarSign className="mt-1 h-5 w-5 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{ad.title}</p>
              {ad.body && <p className="line-clamp-2 text-xs text-muted-foreground">{ad.body}</p>}
              <p className="mt-1 text-[10px] uppercase text-muted-foreground">{ad.active ? "active" : "inactive"}</p>
            </div>
            {ad.target_url && <a href={ad.target_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-muted-foreground" /></a>}
            <button onClick={() => toggle(ad)} className="text-xs font-semibold text-primary">{ad.active ? "Hide" : "Show"}</button>
            <button onClick={() => remove(ad.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
          </div>
        </div>
      ))}
      {ads.length === 0 && <p className="text-xs text-muted-foreground italic">No ads yet.</p>}
    </div>
  );
}

function NoticesAdmin({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const { data: notices = [] } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: async () => {
      const { data } = await supabase.from("app_notices").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });
  const post = async () => {
    if (!message.trim()) return;
    const { error } = await supabase.from("app_notices").insert({ message: message.trim(), level, created_by: isUuid(adminId) ? adminId : null, created_by_firebase_uid: adminId, active: true } as any);
    if (error) { toast.error(error.message); return; }
    setMessage("");
    toast.success("Notice posted");
    qc.invalidateQueries({ queryKey: ["admin-notices"] });
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("app_notices").update({ active: !active } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-notices"] });
  };
  const remove = async (id: string) => {
    await supabase.from("app_notices").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-notices"] });
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-secondary/40 p-3 space-y-2">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notice message…"
          className="w-full rounded-lg bg-background p-3 text-sm text-foreground outline-none" rows={2} />
        <div className="flex items-center gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg bg-background px-3 py-2 text-xs text-foreground">
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="success">Success</option>
          </select>
          <button onClick={post} className="ml-auto flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
            <Megaphone className="h-3.5 w-3.5" /> Post notice
          </button>
        </div>
      </div>
      {notices.map((n: any) => (
        <div key={n.id} className="flex items-start gap-2 rounded-xl bg-secondary p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{n.message}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{n.level} · {n.active ? "active" : "inactive"}</p>
          </div>
          <button onClick={() => toggle(n.id, n.active)} className="text-xs text-primary font-semibold">
            {n.active ? "Hide" : "Show"}
          </button>
          <button onClick={() => remove(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>
        </div>
      ))}
    </div>
  );
}

function BlocksAdmin({ users, adminId }: { users: any[]; adminId: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { data: blocks = [] } = useQuery({
    queryKey: ["admin-blocks"],
    queryFn: async () => {
      const { data } = await supabase.from("user_blocks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });
  const block = async () => {
    if (!target) return;
    if (!isUuid(target.user_id)) { toast.error("Blocking needs a synced Supabase profile for this Firebase user."); return; }
    const { error } = await supabase.from("user_blocks").insert({ user_id: target.user_id, reason: reason || null, blocked_by: isUuid(adminId) ? adminId : null, blocked_by_firebase_uid: adminId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Blocked @${target.username}`);
    setTarget(null); setReason("");
    qc.invalidateQueries({ queryKey: ["admin-blocks"] });
  };
  const unblock = async (id: string) => {
    await supabase.from("user_blocks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blocks"] });
  };
  const matches = search ? users.filter((u) => (u.username || "").toLowerCase().includes(search.toLowerCase())).slice(0, 5) : [];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-secondary/40 p-3 space-y-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setTarget(null); }} placeholder="Search username…"
          className="w-full rounded-lg bg-background p-3 text-sm text-foreground outline-none" />
        {matches.length > 0 && !target && (
          <div className="space-y-1">
            {matches.map((u) => (
              <button key={u.id} onClick={() => { setTarget(u); setSearch(u.username); }} className="w-full text-left rounded-lg bg-background px-3 py-2 text-sm">@{u.username}</button>
            ))}
          </div>
        )}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
          className="w-full rounded-lg bg-background p-3 text-sm text-foreground outline-none" />
        <button onClick={block} disabled={!target}
          className="w-full flex items-center justify-center gap-1 rounded-full bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">
          <Ban className="h-3.5 w-3.5" /> Block user
        </button>
      </div>
      {blocks.map((b: any) => {
        const u = users.find((x) => x.user_id === b.user_id);
        return (
          <div key={b.id} className="flex items-center gap-2 rounded-xl bg-secondary p-3">
            <Ban className="h-4 w-4 text-destructive" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">@{u?.username || b.user_id.slice(0, 8)}</p>
              {b.reason && <p className="text-[11px] text-muted-foreground truncate">{b.reason}</p>}
            </div>
            <button onClick={() => unblock(b.id)} className="text-xs text-primary font-semibold">Unblock</button>
          </div>
        );
      })}
    </div>
  );
}
