import { useEffect, useState } from "react";
import {
  ArrowLeft, Coins as CoinsIcon, Gift, Ticket, Loader2, Copy, Share2,
  ExternalLink, Sparkles, X, Trophy, UserPlus, CalendarDays, ImagePlus, Film,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBalance, spendCoins, buildReferralLink } from "@/lib/coins";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { isUuid } from "@/lib/ids";

const Coins = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [activeCoupon, setActiveCoupon] = useState<any | null>(null);

  const { data: balance = 0 } = useQuery({
    queryKey: ["coin-balance", user?.id],
    enabled: !!user,
    queryFn: () => getBalance(user!.id),
    refetchInterval: 15000,
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").order("cost_coins", { ascending: true });
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["my-redemptions", user?.id],
    enabled: !!user && isUuid(user.id),
    queryFn: async () => {
      const { data } = await supabase.from("coupon_redemptions").select("*, coupons(*)").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["coin-tx", user?.id],
    enabled: !!user && isUuid(user.id),
    queryFn: async () => {
      const { data } = await supabase.from("coin_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const { data: referralStats } = useQuery({
    queryKey: ["referral-stats", user?.id],
    enabled: !!user && isUuid(user.id),
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("referred_by", user!.id);
      return { invited: count || 0 };
    },
  });

  const referralLink = user ? buildReferralLink(user.id) : "";

  const redeem = async (c: any) => {
    if (!user) return;
    if (!isUuid(user.id)) {
      toast.error("Coins need your cloud profile to sync first. Try again after profile sync.");
      return;
    }
    setRedeeming(c.id);
    const ok = await spendCoins(user.id, c.cost_coins, "coupon_redeem", { coupon_id: c.id });
    if (ok) {
      await supabase.from("coupon_redemptions").insert({
        user_id: user.id,
        coupon_id: c.id,
        code_snapshot: c.is_affiliate ? "AFFILIATE-DEAL" : c.code,
        cost_coins: c.cost_coins,
      } as any);
      qc.invalidateQueries({ queryKey: ["coupons"] });
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
      qc.invalidateQueries({ queryKey: ["coin-balance"] });
      if (c.is_affiliate && c.claim_url) {
        toast.success("Deal unlocked! Opening brand page…");
        window.open(c.claim_url, "_blank", "noopener,noreferrer");
      } else {
        toast.success(`Coupon redeemed! Code: ${c.code}`);
        setActiveCoupon({ ...c, isRedeemed: true });
      }
    }
    setRedeeming(null);
  };

  const copy = (s: string, label = "Code") => {
    navigator.clipboard.writeText(s);
    toast.success(`${label} copied`);
  };

  const shareReferral = async () => {
    const text = `Join WarGram and we both get bonus coins! ${referralLink}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join WarGram", text, url: referralLink }); return; } catch {}
    }
    copy(referralLink, "Invite link");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Coins & Rewards</h1>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-5 pb-6 space-y-6">
        {/* HERO BALANCE */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 p-6"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)/0.25) 0%, hsl(var(--primary)/0.08) 60%, transparent 100%)",
          }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -left-6 bottom-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Your wallet
            </div>
            <div className="mt-2 flex items-end gap-3">
              <motion.p
                key={balance}
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-foreground tracking-tight"
              >
                {balance.toLocaleString()}
              </motion.p>
              <CoinsIcon className="mb-2 h-7 w-7 text-primary" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Earn coins, redeem real coupons.</p>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <RewardChip icon={CalendarDays} label="Login" value="+10/day" />
              <RewardChip icon={ImagePlus} label="Post" value="+5" />
              <RewardChip icon={Film} label="Reel" value="+10" />
            </div>
          </div>
        </motion.div>

        {/* REFERRAL CARD */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-2xl border border-border bg-secondary/40 p-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Invite friends, both earn</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            They get <span className="font-bold text-foreground">+100</span> signup bonus,
            you both get <span className="font-bold text-foreground">+50</span> when they join.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/70 px-3 py-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-transparent text-xs text-foreground outline-none truncate"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={() => copy(referralLink, "Invite link")} className="rounded-lg bg-secondary p-1.5" aria-label="Copy invite link">
              <Copy className="h-4 w-4 text-foreground" />
            </button>
            <button onClick={shareReferral} className="rounded-lg bg-primary p-1.5 text-primary-foreground" aria-label="Share invite link">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          {referralStats && referralStats.invited > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-primary font-semibold">
              <Trophy className="h-3 w-3" /> {referralStats.invited} friend{referralStats.invited > 1 ? "s" : ""} joined via your link
            </p>
          )}
        </motion.div>

        {/* COUPONS */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Ticket className="h-4 w-4" /> Available coupons
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Refreshes daily</span>
          </div>
          {coupons.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No coupons available yet. Check back soon.</p>
          ) : (
            <div className="grid gap-2">
              {coupons.map((c: any) => {
                const canAfford = balance >= c.cost_coins;
                const inStock = c.stock > 0;
                return (
                  <motion.div
                    key={c.id}
                    whileHover={{ scale: 1.005 }}
                    className="group rounded-2xl border border-border bg-secondary/40 p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-background border border-border flex items-center justify-center">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.brand || c.title} className="h-full w-full object-contain p-1" loading="lazy" />
                        ) : (
                          <Ticket className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {c.brand && <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{c.brand}</span>}
                          {!inStock && <span className="text-[10px] font-bold text-destructive">Sold out</span>}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                        {c.description && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{c.description}</p>}
                        <p className="mt-1 text-[10px] text-muted-foreground">{c.stock} in stock</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => redeem(c)}
                          disabled={redeeming === c.id || !inStock || !canAfford}
                          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity disabled:opacity-40"
                        >
                          {redeeming === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CoinsIcon className="h-3 w-3" />}
                          {c.cost_coins}
                        </button>
                        <button
                          onClick={() => setActiveCoupon(c)}
                          className="text-[10px] text-primary font-semibold underline-offset-2 hover:underline"
                        >
                          {c.is_affiliate ? "Get deal" : "How to claim"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* MY COUPONS */}
        {redemptions.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><Gift className="h-4 w-4" /> My coupons</h2>
            <div className="space-y-2">
              {redemptions.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl bg-secondary p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{r.coupons?.title || "Coupon"}</p>
                    <p className="font-mono text-sm font-bold text-foreground tracking-wide">{r.code_snapshot}</p>
                  </div>
                  {r.coupons?.claim_url && (
                    <a
                      href={r.coupons.claim_url}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-background p-2"
                      aria-label="Open claim site"
                    >
                      <ExternalLink className="h-4 w-4 text-foreground" />
                    </a>
                  )}
                  <button onClick={() => copy(r.code_snapshot)} className="rounded-lg bg-background p-2" aria-label="Copy code">
                    <Copy className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {txs.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-bold text-foreground">Recent activity</h2>
            <div className="space-y-1">
              {txs.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                  <span className="text-foreground capitalize truncate">{t.reason.replace(/_/g, " ")}</span>
                  <span className={`font-bold tabular-nums ${t.amount > 0 ? "text-primary" : "text-destructive"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* HOW TO CLAIM MODAL */}
      {activeCoupon && (
        <ClaimModal coupon={activeCoupon} onClose={() => setActiveCoupon(null)} onCopy={copy} />
      )}
    </div>
  );
};

function RewardChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/70 backdrop-blur p-2.5 border border-border/40">
      <Icon className="mx-auto h-4 w-4 text-primary mb-1" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function ClaimModal({ coupon, onClose, onCopy }: { coupon: any; onClose: () => void; onCopy: (s: string, label?: string) => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-background border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">How to claim</h3>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            {coupon.image_url && (
              <img src={coupon.image_url} alt={coupon.brand} className="h-14 w-14 rounded-xl border border-border bg-background object-contain p-1" />
            )}
            <div className="flex-1 min-w-0">
              {coupon.brand && <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{coupon.brand}</p>}
              <p className="text-base font-bold text-foreground">{coupon.title}</p>
              {coupon.description && <p className="text-xs text-muted-foreground">{coupon.description}</p>}
            </div>
          </div>

          {coupon.isRedeemed && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-primary font-bold">Your code</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="flex-1 font-mono text-lg font-bold text-foreground">{coupon.code}</p>
                <button onClick={() => onCopy(coupon.code)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                  Copy
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step-by-step</p>
            <ol className="mt-2 space-y-1.5 text-sm text-foreground list-decimal list-inside">
              <li>Tap the redeem button to spend coins and reveal your code.</li>
              <li>{coupon.claim_instructions || "Open the brand's website or app and apply your code at checkout."}</li>
              <li>Enjoy your reward — codes are usually one-time use.</li>
            </ol>
          </div>

          {coupon.claim_url && (
            <a
              href={coupon.claim_url}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              <ExternalLink className="h-4 w-4" /> Open claim page
            </a>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            Promotions are provided by third parties. Availability may change.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default Coins;
