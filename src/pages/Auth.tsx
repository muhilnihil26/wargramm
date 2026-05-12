import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Loader2 } from "lucide-react";
import wargramLogo from "@/assets/wargram-logo.png";

type Mode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const navigate = useNavigate();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();
  const { get } = useAppSettings();
  const isLogin = mode === "login";

  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next") || "/";
  const refParam = params.get("ref");

  useEffect(() => {
    if (user) navigate(nextPath, { replace: true });
  }, [navigate, nextPath, user]);

  if (refParam && typeof window !== "undefined") {
    try {
      localStorage.setItem("wargram-pending-ref", refParam);
    } catch {}
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmail(email, password);
        toast.success("Welcome back!");
      } else {
        await signUpWithEmail(email, password);
        toast.success("Account created. Please check your email to verify your account.");
      }
      navigate(nextPath);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google!");
      navigate(nextPath);
    } catch (error: any) {
      toast.error(error?.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email");
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(email);
      toast.success("Password reset link sent. Check your email.");
      setMode("login");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSendingReset(false);
    }
  };

  const handleSetPassword = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(email);
      toast.success("Password setup link sent. Open your email to choose your password.");
      setMode("login");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src={wargramLogo} alt={get("app_name", "WarGram")} className="mb-4 h-20 w-20" />
          <h1 className="font-brand text-6xl sm:text-7xl text-foreground">{get("app_name", "WarGram")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{get("brand_tagline", "by War.Dev")}</p>
          {get("content_auth_subtitle") && (
            <p className="mt-2 text-center text-xs text-muted-foreground">{get("content_auth_subtitle")}</p>
          )}
          {refParam && (
            <div className="mt-3 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] text-primary">
              🎁 You were invited — sign up to claim your bonus coins
            </div>
          )}
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-foreground font-semibold">Reset your password</p>
              <p className="mt-1 text-xs text-muted-foreground">We'll email you a link to set a new password.</p>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              required
            />
            <button
              type="submit"
              disabled={sendingReset}
              className="flex w-full items-center justify-center rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {!isLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                    required
                  />
                </>
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={1}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Loading..." : isLogin ? "Discover The World" : "Sign Up"}
              </button>
            </form>

            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {isLogin && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={sendingReset}
                  className="rounded-lg bg-secondary px-3 py-2 text-center text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  Set password
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="rounded-lg bg-secondary px-3 py-2 text-center text-xs font-semibold text-foreground"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <div className="mt-6 text-center text-xs text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setMode(isLogin ? "signup" : "login")}
                className="font-semibold text-primary hover:underline"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {get("content_footer", "Made by War.Dev")}
        </p>
      </div>
    </div>
  );
};

export default Auth;
