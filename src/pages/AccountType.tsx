import { useState, useEffect } from "react";
import { ArrowLeft, User, Briefcase, Code as CodeIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isUuid } from "@/lib/ids";
import { readLocalProfile, updateLocalProfile } from "@/lib/localProfile";

type AccountType = "personal" | "business" | "developer";

const OPTIONS: { value: AccountType; icon: typeof User; title: string; desc: string }[] = [
  { value: "personal", icon: User, title: "Personal", desc: "Standard account for sharing with friends." },
  { value: "business", icon: Briefcase, title: "Business", desc: "For brands, creators, and shops. Get richer profile fields and (soon) analytics." },
  { value: "developer", icon: CodeIcon, title: "Developer", desc: "For builders. Reserved for upcoming API + webhooks access." },
];

const AccountType = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AccountType>("personal");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["account-type", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user || !isUuid(user.id)) return readLocalProfile(user) as any;
      const { data } = await supabase.from("profiles").select("account_type").eq("user_id", user!.id).maybeSingle();
      return data as { account_type: AccountType } | null;
    },
  });

  useEffect(() => {
    if (profile?.account_type) setSelected(profile.account_type);
  }, [profile?.account_type]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    if (!isUuid(user.id)) {
      updateLocalProfile(user, { account_type: selected });
      setSaving(false);
      toast.success(`Switched to ${selected} account`);
      qc.invalidateQueries({ queryKey: ["account-type"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate(-1);
      return;
    }
    const { error } = await supabase.from("profiles").update({ account_type: selected } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Switched to ${selected} account`);
    qc.invalidateQueries({ queryKey: ["account-type"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Account type</h1>
      </header>
      <div className="mx-auto max-w-lg p-4 space-y-3">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setSelected(o.value)}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${selected === o.value ? "border-primary bg-secondary" : "border-border"}`}
          >
            <o.icon className="h-6 w-6 text-foreground mt-0.5" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{o.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
            </div>
            {selected === o.value && <span className="text-xs font-bold text-primary">Selected</span>}
          </button>
        ))}
        <button onClick={save} disabled={saving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "Saving…" : "Apply"}
        </button>
      </div>
    </div>
  );
};

export default AccountType;
