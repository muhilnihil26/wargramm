import { ArrowLeft, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

const sections = [
  { title: "Getting started", body: "Sign up with email + password (any password works) or Google. Confirm your email if asked. You'll land on the home feed." },
  { title: "Creating a post", body: "Tap the + tab. Pick a photo or video, add a caption, optionally attach a music track, choose audience (Public / Followers), then Share. Each post earns you 5 coins." },
  { title: "Creating a reel", body: "Open the Reels tab and tap the + button. Upload a short video, optionally trim a music track. Each reel earns you 10 coins." },
  { title: "Stories", body: "Tap your story circle on home. Photos and videos both work. Set audience to Public, Followers, or Only me. Stories expire after 24 hours." },
  { title: "Privacy", body: "In Settings → Account privacy, switch to a private account. People then need to send a follow request you must approve." },
  { title: "Coins & rewards", body: "Earn 100 coins for daily login, 5 per post, 10 per reel. Spend coins on real coupons under Profile → Coins." },
  { title: "Messaging & calls", body: "Tap a profile and choose Message to chat. Audio calls use WebRTC and are end-to-end between two devices." },
  { title: "Account types", body: "Personal is the default. Upgrade to Business for analytics-friendly profiles, or Developer to access API/webhooks (coming soon)." },
];

const Manual = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <BookOpen className="h-5 w-5 text-foreground" />
        <h1 className="text-lg font-bold text-foreground">User manual</h1>
      </header>
      <div className="mx-auto max-w-lg p-4 space-y-5">
        {sections.map((s) => (
          <article key={s.title}>
            <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Manual;
