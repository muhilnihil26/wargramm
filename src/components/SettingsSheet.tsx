import { useState, useEffect } from "react";
import { X, ChevronRight, User, Bell, Lock, Palette, HelpCircle, LogOut, Shield, Info, Heart, Bookmark, Eye, Phone, KeyRound, Sun, Moon, BadgeCheck, Coins, BookOpen, FileText, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getWebPushPreference, setWebPushPreference, getWebPushStatus } from "@/lib/webPush";
import { isConfiguredAdmin } from "@/lib/admin";

interface SettingsSheetProps {
  onClose: () => void;
  onEditProfile: () => void;
}

interface RowProps {
  icon: any;
  label: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
}
function Row({ icon: Icon, label, hint, onClick, danger }: RowProps) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60">
      <Icon className={`h-5 w-5 ${danger ? "text-destructive" : "text-foreground"}`} strokeWidth={1.5} />
      <span className={`flex-1 text-sm ${danger ? "text-destructive" : "text-foreground"}`}>{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {!danger && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function PushStatusBadge() {
  const status = getWebPushStatus();
  const map = {
    granted: { label: "On", cls: "bg-primary/15 text-primary border-primary/30" },
    denied: { label: "Blocked", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    default: { label: "Ask", cls: "bg-secondary text-muted-foreground border-border" },
    unsupported: { label: "N/A", cls: "bg-secondary text-muted-foreground border-border" },
  } as const;
  const m = map[status];
  return <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${m.cls}`}>{m.label}</span>;
}

type View = "main" | "password" | "phone" | "theme" | "privacy";

export function SettingsSheet({ onClose, onEditProfile }: SettingsSheetProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("main");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // Password
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Phone
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">(
    (typeof window !== "undefined" && document.documentElement.classList.contains("light")) ? "light" : "dark"
  );

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isConfiguredAdmin(user)) return true;
      if (!user || !isUuid(user.id)) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin");
      return (data && data.length > 0) || false;
    },
  });

  const { data: verification } = useQuery({
    queryKey: ["my-verification-row", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_verified, verification_status").eq("user_id", user!.id).maybeSingle();
      return data as { is_verified: boolean | null; verification_status: string | null } | null;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("phone, is_private, show_activity").eq("user_id", user!.id).maybeSingle();
      return data as { phone: string | null; is_private: boolean | null; show_activity: boolean | null } | null;
    },
  });

  const [isPrivate, setIsPrivate] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(getWebPushPreference());

  const handleTogglePush = async (next: boolean) => {
    const result = await setWebPushPreference(next);
    setPushEnabled(result);
  };

  useEffect(() => {
    if (profile?.phone) setPhone(profile.phone);
    setIsPrivate(!!profile?.is_private);
    setShowActivity(profile?.show_activity !== false);
  }, [profile?.phone, profile?.is_private, profile?.show_activity]);

  // Persist + apply theme
  useEffect(() => {
    const stored = localStorage.getItem("wargram-theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.classList.toggle("light", stored === "light");
    }
  }, []);

  const applyTheme = (next: "light" | "dark") => {
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("wargram-theme", next);
  };

  const go = (path: string) => { onClose(); navigate(path); };
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const handleChangePassword = async () => {
    if (newPw.length < 1) { toast.error("Enter a new password"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setNewPw(""); setConfirmPw("");
    setView("main");
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const cleaned = phone.trim();
    if (cleaned && !/^\+?[\d\s\-()]{6,20}$/.test(cleaned)) {
      toast.error("Enter a valid phone number");
      return;
    }
    setPhoneSaving(true);
    const { error } = await supabase.from("profiles").update({ phone: cleaned || null } as any).eq("user_id", user.id);
    setPhoneSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Phone saved");
    queryClient.invalidateQueries({ queryKey: ["profile-settings"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    setView("main");
  };

  const handleSavePrivacy = async () => {
    if (!user) return;
    setPrivacySaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ is_private: isPrivate, show_activity: showActivity } as any)
      .eq("user_id", user.id);
    setPrivacySaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Privacy updated");
    queryClient.invalidateQueries({ queryKey: ["profile-settings"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    setView("main");
  };

  const Header = ({ title, back }: { title: string; back?: boolean }) => (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
      {back ? (
        <button onClick={() => setView("main")} className="text-sm text-primary">Back</button>
      ) : <div className="w-10" />}
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <button onClick={onClose}><X className="h-5 w-5 text-foreground" /></button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        {view === "main" && (
          <>
            <Header title="Settings and activity" />
            <Section title="Your account">
              <Row icon={User} label="Edit profile" onClick={() => { onClose(); onEditProfile(); }} />
              <Row icon={Briefcase} label="Account type" onClick={() => go("/account-type")} />
              <Row icon={KeyRound} label="Change password" onClick={() => setView("password")} />
              <Row icon={Phone} label="Phone number" hint={profile?.phone || "Add"} onClick={() => setView("phone")} />
              <Row icon={Lock} label="Account privacy" hint={isPrivate ? "Private" : "Public"} onClick={() => setView("privacy")} />
              <Row icon={Eye} label="Saved" onClick={() => go("/profile")} />
              <Row icon={Heart} label="Your activity" onClick={() => go("/notifications")} />
            </Section>

            <Section title="Coins & rewards">
              <Row icon={Coins} label="Coins & coupons" onClick={() => go("/coins")} />
            </Section>

            <Section title="How you use WarGram">
              <div className="flex w-full items-center gap-3 px-4 py-3">
                <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-foreground">Web notifications</p>
                    <PushStatusBadge />
                  </div>
                  <p className="text-xs text-muted-foreground">Get alerts in this browser</p>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={handleTogglePush} />
              </div>
              {getWebPushStatus() === "default" && (
                <div className="mx-4 my-2 rounded-xl border border-primary/30 bg-primary/10 p-3">
                  <p className="text-xs text-foreground">
                    Tap <span className="font-bold">Allow</span> when your browser asks, so we can send you DMs, likes, and call alerts.
                  </p>
                  <button
                    onClick={() => handleTogglePush(true)}
                    className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                  >
                    Allow notifications
                  </button>
                </div>
              )}
              {getWebPushStatus() === "denied" && (
                <div className="mx-4 my-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs text-foreground">
                    Notifications are blocked. Open your browser site settings (lock icon in the address bar) → Notifications → <span className="font-bold">Allow</span>, then refresh.
                  </p>
                </div>
              )}
              <Row icon={Bell} label="View notifications" onClick={() => go("/notifications")} />
              <Row icon={Bookmark} label="Saved posts" onClick={() => go("/profile")} />
            </Section>

            <Section title="Account verification">
              <Row
                icon={BadgeCheck}
                label="Verified badge"
                hint={verification?.is_verified ? "Verified" : verification?.verification_status === "pending" ? "Under review" : "Apply"}
                onClick={() => go("/verification")}
              />
            </Section>

            <Section title="App and media">
              <Row icon={Palette} label="Theme" hint={theme === "light" ? "Light" : "Dark"} onClick={() => setView("theme")} />
            </Section>

            <Section title="More info and support">
              <Row icon={BookOpen} label="User manual" onClick={() => go("/manual")} />
              <Row icon={FileText} label="Terms of Service" onClick={() => go("/legal/terms")} />
              <Row icon={FileText} label="Privacy Policy" onClick={() => go("/legal/privacy")} />
              <Row icon={HelpCircle} label="Help" onClick={() => go("/manual")} />
              <Row icon={Info} label="About" onClick={() => go("/manual")} />
            </Section>

            {isAdmin && (
              <Section title="Admin">
                <Row icon={Shield} label="Admin panel" onClick={() => go("/admin")} />
              </Section>
            )}

            <div className="mt-4 border-t border-border">
              {confirmingSignOut ? (
                <div className="px-4 py-4 space-y-3">
                  <p className="text-sm text-foreground text-center">Log out of WarGram?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmingSignOut(false)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-semibold text-foreground">Cancel</button>
                    <button onClick={handleSignOut} className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-destructive-foreground">​Discover The World</button>
                  </div>
                </div>
              ) : (
                <Row icon={LogOut} label="​Discover The World" danger onClick={() => setConfirmingSignOut(true)} />
              )}
            </div>

            <p className="text-center text-[10px] text-muted-foreground py-3">WarGram · v1.0</p>
          </>
        )}

        {view === "password" && (
          <>
            <Header title="Change password" back />
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Choose any new password.</p>
              <div>
                <label className="text-xs text-muted-foreground">New password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" placeholder="New password" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Confirm new password</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <button onClick={handleChangePassword} disabled={pwSaving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          </>
        )}

        {view === "phone" && (
          <>
            <Header title="Phone number" back />
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Add a phone number to your profile.</p>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <button onClick={handleSavePhone} disabled={phoneSaving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {phoneSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}

        {view === "theme" && (
          <>
            <Header title="Theme" back />
            <div className="p-4 space-y-2">
              <button onClick={() => applyTheme("dark")} className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${theme === "dark" ? "border-primary bg-secondary" : "border-border"}`}>
                <Moon className="h-5 w-5 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Dark</p>
                  <p className="text-xs text-muted-foreground">Use a dark theme</p>
                </div>
                {theme === "dark" && <span className="text-xs text-primary font-bold">Active</span>}
              </button>
              <button onClick={() => applyTheme("light")} className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${theme === "light" ? "border-primary bg-secondary" : "border-border"}`}>
                <Sun className="h-5 w-5 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Light</p>
                  <p className="text-xs text-muted-foreground">Use a light theme</p>
                </div>
                {theme === "light" && <span className="text-xs text-primary font-bold">Active</span>}
              </button>
            </div>
          </>
        )}

        {view === "privacy" && (
          <>
            <Header title="Account privacy" back />
            <div className="p-4 space-y-3">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${isPrivate ? "border-primary bg-secondary" : "border-border"}`}
              >
                <Lock className="h-5 w-5 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Private account</p>
                  <p className="text-xs text-muted-foreground">Only people you approve can follow you and see your posts.</p>
                </div>
                <span className={`text-xs font-bold ${isPrivate ? "text-primary" : "text-muted-foreground"}`}>{isPrivate ? "On" : "Off"}</span>
              </button>

              <button
                onClick={() => setShowActivity(!showActivity)}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${!showActivity ? "border-primary bg-secondary" : "border-border"}`}
              >
                <Eye className="h-5 w-5 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Show activity status</p>
                  <p className="text-xs text-muted-foreground">Let others see when you were last active.</p>
                </div>
                <span className={`text-xs font-bold ${showActivity ? "text-primary" : "text-muted-foreground"}`}>{showActivity ? "On" : "Off"}</span>
              </button>

              <button onClick={handleSavePrivacy} disabled={privacySaving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {privacySaving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
