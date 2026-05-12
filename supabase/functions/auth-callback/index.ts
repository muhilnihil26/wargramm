// Auth callback proxy. Reachable at /functions/v1/auth-callback.
// Admin can expose this through the deployed app as /api/auth/callback via a redirect/rewrite.
// This function reads ?code=...&next=... and forwards to Supabase verify, then bounces the browser
// back into the SPA so onAuthStateChange picks up the session.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const origin = url.searchParams.get("origin") || Deno.env.get("APP_ORIGIN") || "https://wargram.app";

  // If no code, just bounce home.
  if (!code) {
    return Response.redirect(`${origin}${next}`, 302);
  }

  // Pass-through: bounce to the SPA with the code in the hash.
  // The Supabase JS client picks it up via detectSessionInUrl on load.
  const dest = `${origin}/auth?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
  return Response.redirect(dest, 302);
});
