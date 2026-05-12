import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_KEYS = [
  "app_name", "story_time_limit", "reel_time_limit", "max_caption_length",
  "suggested_count", "feed_page_size", "ig_import_suffix", "support_email",
  "theme_primary", "theme_background", "theme_accent", "theme_foreground",
  "theme_secondary", "theme_muted", "theme_border", "theme_card",
  "theme_destructive", "theme_ring",
  "brand_tagline",
  "content_welcome", "content_tagline", "content_auth_subtitle", "content_footer",
  "custom_css",
];
const KNOWN_FLAGS = [
  "stories", "reels", "music", "dms", "notifications", "explore",
  "instagram", "suggestions", "import_to_wargram",
];

const SYSTEM_PROMPT = `You are the WarGram admin assistant. You help admins configure the app by translating natural-language requests into setting changes.

You can change three kinds of things by calling apply_settings with an array of changes:
1. Settings (key/value text). Known keys: ${KNOWN_KEYS.join(", ")}.
2. Feature flags (on/off). Use key "flag_<name>" with value "true" or "false". Known flags: ${KNOWN_FLAGS.join(", ")}.
3. Theme colors. Use theme_primary / theme_background / theme_accent. Values MUST be raw HSL like "340 75% 55%" (no hsl() wrapper, no #hex).

Rules:
- For colors, convert hex/named colors to HSL space-separated triplet (e.g. "red" -> "0 84% 60%").
- For custom_css, only return safe CSS (no @import of unknown origins, no JS).
- Keep changes minimal — only touch what the user asked for.
- After calling the tool, write a 1-sentence confirmation of what changed.
- If the request is unclear or unsafe, ask a clarifying question instead of calling the tool.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles || roles.length === 0) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { messages = [] } = await req.json();

    // Provide current settings as context
    const { data: currentSettings } = await admin.from("admin_settings").select("key, value");
    const ctx = (currentSettings || []).map((s: any) => `${s.key} = ${JSON.stringify(s.value)}`).join("\n");

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL");
    if (!aiGatewayUrl) {
      return new Response(JSON.stringify({ error: "AI gateway is not configured." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiResp = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\nCurrent settings:\n" + (ctx || "(none yet)") },
          ...messages,
        ],
        tools: [{
          type: "function",
          function: {
            name: "apply_settings",
            description: "Persist setting changes to admin_settings.",
            parameters: {
              type: "object",
              properties: {
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string", description: "Setting key (or flag_<name>)" },
                      value: { type: "string" },
                    },
                    required: ["key", "value"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string", description: "1-sentence confirmation" },
              },
              required: ["changes", "summary"],
              additionalProperties: false,
            },
          },
        }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const choice = data.choices?.[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    let applied: { key: string; value: string }[] = [];
    let summary = choice?.content || "";

    if (toolCall?.function?.name === "apply_settings") {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const changes: { key: string; value: string }[] = args.changes || [];
      summary = args.summary || summary;

      for (const ch of changes) {
        if (!ch.key || typeof ch.value !== "string") continue;
        const { data: existing } = await admin.from("admin_settings").select("id").eq("key", ch.key).maybeSingle();
        if (existing) {
          await admin.from("admin_settings").update({ value: ch.value }).eq("id", existing.id);
        } else {
          await admin.from("admin_settings").insert({ key: ch.key, value: ch.value });
        }
        applied.push(ch);
      }
    }

    return new Response(JSON.stringify({ summary, applied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
