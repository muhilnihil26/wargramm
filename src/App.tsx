import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Apply persisted theme synchronously before render
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("wargram-theme");
  if (stored === "light") document.documentElement.classList.add("light");
}

import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSettingsProvider, useAppSettings } from "@/hooks/useAppSettings";
import { BottomNav } from "@/components/BottomNav";
import { useLocation } from "react-router-dom";
import Index from "./pages/Index.tsx";
import Explore from "./pages/Explore.tsx";
import Create from "./pages/Create.tsx";
import Reels from "./pages/Reels.tsx";
import Profile from "./pages/Profile.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Messages from "./pages/Messages.tsx";
import Notifications from "./pages/Notifications.tsx";
import UserProfile from "./pages/UserProfile.tsx";
import FollowList from "./pages/FollowList.tsx";
import Admin from "./pages/Admin.tsx";
import YouTube from "./pages/YouTube.tsx";
import Shorts from "./pages/Shorts.tsx";
import Verification from "./pages/Verification.tsx";
import NotFound from "./pages/NotFound.tsx";
import Coins from "./pages/Coins.tsx";
import Manual from "./pages/Manual.tsx";
import Legal from "./pages/Legal.tsx";
import AccountType from "./pages/AccountType.tsx";
import { usePresence } from "@/hooks/usePresence";
import { IntroSplash } from "@/components/IntroSplash";
import { NotificationListener } from "@/components/NotificationListener";
import { NoticeBanner } from "@/components/NoticeBanner";
import { WelcomeTour } from "@/components/WelcomeTour";
import { BlockedGate } from "@/components/BlockedGate";
import { AppLoading } from "@/components/AppLoading";
import { claimDailyLoginBonus, applySignupBonuses } from "@/lib/coins";
import { maybeRequestNotificationPermission } from "@/lib/webPush";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function FlagGate({ flagKey, children }: { flagKey: string; children: React.ReactNode }) {
  const { flag } = useAppSettings();
  if (!flag(flagKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Routes where the bottom nav should NOT appear (chat view manages its own viewport)
const HIDE_BOTTOMNAV_ROUTES = ["/messages"];

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  usePresence();

  useEffect(() => {
    if (user) {
      // Apply signup + referral bonuses if a pending referral was stashed
      const ref = localStorage.getItem("wargram-pending-ref");
      applySignupBonuses(user.id, ref || null).then(() => {
        if (ref) localStorage.removeItem("wargram-pending-ref");
      });
      claimDailyLoginBonus(user.id);
      maybeRequestNotificationPermission();
    }
  }, [user?.id]);

  const hideBottomNav = HIDE_BOTTOMNAV_ROUTES.some((p) => location.pathname.startsWith(p));

  return (
    <BlockedGate>
      <NoticeBanner />
      <Routes>
        <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/explore" element={<ProtectedRoute><FlagGate flagKey="explore"><Explore /></FlagGate></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
        <Route path="/reels" element={<ProtectedRoute><FlagGate flagKey="reels"><Reels /></FlagGate></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><FlagGate flagKey="dms"><Messages /></FlagGate></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><FlagGate flagKey="notifications"><Notifications /></FlagGate></ProtectedRoute>} />
        <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/user/:userId/follows" element={<ProtectedRoute><FollowList /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/youtube" element={<ProtectedRoute><YouTube /></ProtectedRoute>} />
        <Route path="/shorts" element={<ProtectedRoute><Shorts /></ProtectedRoute>} />
        <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
        <Route path="/coins" element={<ProtectedRoute><Coins /></ProtectedRoute>} />
        <Route path="/manual" element={<ProtectedRoute><Manual /></ProtectedRoute>} />
        <Route path="/legal/:kind" element={<Legal />} />
        <Route path="/account-type" element={<ProtectedRoute><AccountType /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && !hideBottomNav && <BottomNav />}
      {user && <NotificationListener />}
      {user && <WelcomeTour />}
    </BlockedGate>
  );
}

const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <IntroSplash />
      <Router>
        <AuthProvider>
          <AppSettingsProvider>
            <AppRoutes />
          </AppSettingsProvider>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
