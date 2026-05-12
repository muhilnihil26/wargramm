// Daily coupon refresh: rotates a random subset of coupons (new code, new stock,
// random cost) so the rewards page feels fresh every day. Triggered by pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: coupons, error } = await supabase.from("coupons").select("id, cost_coins, stock");
    if (error) throw error;

    let updated = 0;
    for (const c of coupons || []) {
      const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
      // Rotate code daily — keep brand prefix if present
      const prefix = (c as any).code?.split("-")?.[0] || "WG";
      const newCode = `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const newCost = Math.max(200, c.cost_coins + rand(-100, 100));
      const newStock = Math.min(200, Math.max(10, c.stock + rand(-5, 25)));

      await supabase.from("coupons").update({
        code: newCode,
        cost_coins: newCost,
        stock: newStock,
      }).eq("id", c.id);
      updated++;
    }

    return new Response(JSON.stringify({ ok: true, rotated: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
