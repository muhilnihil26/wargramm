import { useEffect, useState } from "react";
import { X, Megaphone, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Notice { id: string; message: string; level: string; }

const STORAGE_KEY = "wargram-dismissed-notices";

export function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("app_notices")
        .select("id,message,level")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const top = (data || [])[0] as Notice | undefined;
      if (!top) { setNotice(null); return; }
      const dismissed: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (dismissed.includes(top.id)) { setNotice(null); return; }
      setNotice(top);
    };
    load();
    const ch = supabase.channel("app-notices")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notices" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  if (!notice) return null;

  const dismiss = () => {
    const dismissed: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    dismissed.push(notice.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    setNotice(null);
  };

  const Icon = notice.level === "warn" ? AlertTriangle : notice.level === "success" ? CheckCircle2 : Megaphone;
  const tone =
    notice.level === "warn" ? "bg-destructive/15 border-destructive/40 text-destructive"
    : notice.level === "success" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
    : "bg-primary/10 border-primary/30 text-primary";

  return (
    <div className={`sticky top-0 z-[60] border-b px-3 py-2 text-xs sm:text-sm ${tone}`}>
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="flex-1 font-medium">{notice.message}</p>
        <button onClick={dismiss} aria-label="Dismiss notice" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
