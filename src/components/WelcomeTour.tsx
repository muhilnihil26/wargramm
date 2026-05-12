import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Film, Camera, Coins, MessageCircle, Shield, ArrowRight, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const SLIDES = [
  { icon: Sparkles, title: "Welcome to WarGram", body: "Share moments, earn coins, and unlock real brand deals — all in one place." },
  { icon: Film, title: "Reels & Posts", body: "Tap the + to upload photos, videos, or remix reels with music and lyrics overlays." },
  { icon: Camera, title: "Filters & Stickers", body: "Open the in-app camera for Snapchat-style filters, emoji stickers, and quick edits." },
  { icon: Coins, title: "Earn & Redeem", body: "Daily login = 10 coins. Invite friends = 50 each. Spend coins to unlock real brand deals." },
  { icon: MessageCircle, title: "Chat & Calls", body: "Send messages, voice notes, share posts, and start audio/video calls with friends." },
  { icon: Shield, title: "Get Verified", body: "Apply for personal, business, or developer verification from Settings → Verification." },
];

const TOOLTIP_STEPS = [
  { selector: "[data-tour='nav-home']", text: "Your home feed lives here." },
  { selector: "[data-tour='nav-explore']", text: "Discover trending posts & people." },
  { selector: "[data-tour='nav-create']", text: "Tap + to post photos, reels, or stories." },
  { selector: "[data-tour='nav-reels']", text: "Swipe through endless reels here." },
  { selector: "[data-tour='nav-profile']", text: "Your profile, settings, and coins." },
];

export function WelcomeTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"slides" | "tooltips" | "done">("done");
  const [slide, setSlide] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const localKey = `wargram-tour-complete:${user.uid}`;
      if (localStorage.getItem(localKey) === "true") return;

      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.onboarded_at) {
        localStorage.setItem(localKey, "true");
        return;
      }

      const createdAt = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
      const lastSignInAt = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : createdAt;
      const isNewUser = Math.abs(lastSignInAt - createdAt) < 5 * 60 * 1000;
      if (isNewUser) setPhase("slides");
    })();
  }, [user]);

  useEffect(() => {
    if (phase !== "tooltips") return;
    const tip = TOOLTIP_STEPS[tipIdx];
    if (!tip) { finish(); return; }
    const el = document.querySelector(tip.selector);
    if (!el) {
      // skip missing
      setTipIdx((i) => i + 1);
      return;
    }
    setRect((el as HTMLElement).getBoundingClientRect());
    const onResize = () => setRect((el as HTMLElement).getBoundingClientRect());
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [phase, tipIdx]);

  const finish = async () => {
    setPhase("done");
    if (user) {
      localStorage.setItem(`wargram-tour-complete:${user.uid}`, "true");
      await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() } as any).eq("user_id", user.id);
    }
    navigate("/", { replace: true });
  };

  if (phase === "done") return null;

  if (phase === "slides") {
    const Slide = SLIDES[slide];
    const Icon = Slide.icon;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-border bg-background overflow-hidden"
        >
          <div className="relative h-44 bg-gradient-to-br from-primary/30 via-primary/10 to-background flex items-center justify-center">
            <Icon className="h-16 w-16 text-primary" strokeWidth={1.5} />
            <button onClick={finish} aria-label="Skip" className="absolute top-3 right-3 rounded-full bg-background/80 p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6 text-center">
            <h2 className="text-xl font-bold text-foreground">{Slide.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{Slide.body}</p>
            <div className="mt-4 flex justify-center gap-1.5">
              {SLIDES.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setSlide((s) => Math.max(0, s - 1))}
                disabled={slide === 0}
                className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {slide < SLIDES.length - 1 ? (
                <button
                  onClick={() => setSlide((s) => s + 1)}
                  className="flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => { setPhase("tooltips"); setTipIdx(0); }}
                  className="flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
                >
                  Take a tour <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Tooltips phase
  if (!rect) return null;
  const tip = TOOLTIP_STEPS[tipIdx];
  const tooltipTop = rect.top - 90 < 8 ? rect.bottom + 12 : rect.top - 90;
  const tooltipLeft = Math.max(8, Math.min(window.innerWidth - 280 - 8, rect.left + rect.width / 2 - 140));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {/* Dim mask with cutout */}
        <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={() => setTipIdx((i) => i + 1)}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - 8} y={rect.top - 8}
                width={rect.width + 16} height={rect.height + 16}
                rx={12} ry={12} fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)" />
        </svg>

        <motion.div
          key={tipIdx}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="absolute pointer-events-auto w-[280px] rounded-2xl border border-border bg-background p-4 shadow-2xl"
          style={{ top: tooltipTop, left: tooltipLeft }}
        >
          <p className="text-sm text-foreground">{tip.text}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tipIdx + 1} / {TOOLTIP_STEPS.length}</span>
            <div className="flex gap-2">
              <button onClick={finish} className="text-xs text-muted-foreground">Skip</button>
              <button
                onClick={() => setTipIdx((i) => i + 1)}
                className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
              >
                {tipIdx + 1 === TOOLTIP_STEPS.length ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
