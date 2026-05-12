import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isUuid } from "@/lib/ids";

async function getRate(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureRow(userId: string) {
  if (!isUuid(userId)) return;
  const { data } = await supabase.from("user_coins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) {
    await supabase.from("user_coins").insert({ user_id: userId, balance: 0 } as any);
  }
}

export async function awardCoins(userId: string, amount: number, reason: string, metadata?: any, opts?: { silent?: boolean }) {
  if (!isUuid(userId) || amount === 0) return;
  await ensureRow(userId);
  const { data: row } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
  const next = (row?.balance ?? 0) + amount;
  await supabase.from("user_coins").update({ balance: next, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
  await supabase.from("coin_transactions").insert({ user_id: userId, amount, reason, metadata } as any);
  if (amount > 0 && !opts?.silent) toast.success(`+${amount} coins`, { description: reason.replace(/_/g, " ") });
}

export async function rewardForPost(userId: string) {
  const r = await getRate("coins_post_reward", 5);
  await awardCoins(userId, r, "post_reward");
}

export async function rewardForReel(userId: string) {
  const r = await getRate("coins_reel_reward", 10);
  await awardCoins(userId, r, "reel_reward");
}

export async function claimDailyLoginBonus(userId: string) {
  if (!isUuid(userId)) return;
  await ensureRow(userId);
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabase.from("user_coins").select("last_login_bonus_at, balance").eq("user_id", userId).maybeSingle();
  if (row?.last_login_bonus_at === today) return;
  const r = await getRate("coins_login_bonus", 10);
  const next = (row?.balance ?? 0) + r;
  await supabase.from("user_coins").update({ balance: next, last_login_bonus_at: today, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
  await supabase.from("coin_transactions").insert({ user_id: userId, amount: r, reason: "login_bonus" } as any);
  toast.success(`Daily bonus: +${r} coins 🎉`);
}

export async function getBalance(userId: string): Promise<number> {
  if (!isUuid(userId)) return 0;
  const { data } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? 0;
}

export async function spendCoins(userId: string, amount: number, reason: string, metadata?: any): Promise<boolean> {
  if (!isUuid(userId)) return false;
  await ensureRow(userId);
  const { data: row } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
  const bal = row?.balance ?? 0;
  if (bal < amount) {
    toast.error(`Need ${amount - bal} more coins`);
    return false;
  }
  await supabase.from("user_coins").update({ balance: bal - amount, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
  await supabase.from("coin_transactions").insert({ user_id: userId, amount: -amount, reason, metadata } as any);
  return true;
}

/**
 * Apply signup bonuses + referral bonuses for a brand-new user.
 * - new user gets `coins_signup_bonus` (default 100)
 * - if `referrerUserId` is provided and is not the new user, both get `coins_referral_bonus` (default 50)
 */
export async function applySignupBonuses(newUserId: string, referrerUserId?: string | null) {
  if (!isUuid(newUserId)) return;
  // signup bonus (one-time — use a dedicated reason; if already applied, skip)
  const { data: existing } = await supabase
    .from("coin_transactions")
    .select("id")
    .eq("user_id", newUserId)
    .eq("reason", "signup_bonus")
    .limit(1)
    .maybeSingle();
  if (!existing) {
    const signupAmt = await getRate("coins_signup_bonus", 100);
    await awardCoins(newUserId, signupAmt, "signup_bonus", null, { silent: true });
    toast.success(`Welcome! +${signupAmt} coins 🎁`);
  }

  if (referrerUserId && referrerUserId !== newUserId) {
    // mark referral on profile (best-effort)
    await supabase.from("profiles").update({ referred_by: referrerUserId } as any).eq("user_id", newUserId);

    // prevent double-applying the referral
    const { data: dupe } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", newUserId)
      .eq("reason", "referral_signup")
      .limit(1)
      .maybeSingle();
    if (!dupe) {
      const refAmt = await getRate("coins_referral_bonus", 50);
      await awardCoins(newUserId, refAmt, "referral_signup", { referrerUserId }, { silent: true });
      await awardCoins(referrerUserId, refAmt, "referral_reward", { newUserId }, { silent: true });
      toast.success(`Referral bonus: +${refAmt} coins 🤝`);
    }
  }
}

export function buildReferralLink(userId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://wargram.lovable.app";
  return `${base}/auth?ref=${userId}`;
}
