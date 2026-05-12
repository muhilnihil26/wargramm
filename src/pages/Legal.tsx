import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const TERMS = `By using WarGram you agree to: be at least 13 years old, post only content you own or have rights to use, refrain from harassment, hate speech, illegal content, sexual content involving minors, spam, or impersonation. You retain ownership of content you post; you grant WarGram a non-exclusive license to host and display it. Accounts violating these terms may be suspended without notice. WarGram is provided "as is" without warranties. Disputes are resolved under the laws of your jurisdiction.`;

const PRIVACY = `WarGram stores: your email, password hash, profile data you provide (username, bio, avatar, phone if added), posts/reels/stories you create, messages you send, follow relationships, and coin balances. We use Firebase for app login and Supabase as the database and media provider. We do NOT sell your data. You may request deletion at any time by contacting support — your account, posts, reels, stories, and messages will be removed. Cookies and localStorage are used for session persistence and theme preference. Calls are peer-to-peer (WebRTC) and not recorded.`;

const Legal = () => {
  const navigate = useNavigate();
  const { kind } = useParams();
  const isTerms = kind === "terms";
  const title = isTerms ? "Terms of Service" : "Privacy Policy";
  const body = isTerms ? TERMS : PRIVACY;
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </header>
      <div className="mx-auto max-w-lg p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{body}</p>
        <p className="mt-6 text-[10px] text-muted-foreground">Last updated: April 2026</p>
      </div>
    </div>
  );
};

export default Legal;
