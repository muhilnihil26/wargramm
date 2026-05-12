import { Heart, MessageCircle, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import wargramLogo from "@/assets/wargram-logo.png";
import { BrandText } from "./BrandText";
import { isConfiguredAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/ids";

export function TopHeader() {
  const { user } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      if (isConfiguredAdmin(user)) return true;
      if (!isUuid(user.id)) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });

  const { data: unreadNotif = 0 } = useQuery({
    queryKey: ["unread-notif-count", user?.id],
    enabled: !!user && isUuid(user.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count || 0;
    },
  });

  const { data: unreadMsg = 0 } = useQuery({
    queryKey: ["unread-msg-count", user?.id],
    enabled: !!user && isUuid(user.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`);
      if (!convos || convos.length === 0) return 0;
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convos.map((c) => c.id))
        .eq("read", false)
        .neq("sender_id", user!.id);
      return count || 0;
    },
  });

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={wargramLogo} alt="WarGram" className="h-7 w-7" />
          <BrandText className="text-3xl sm:text-4xl text-foreground">WarGram</BrandText>
        </Link>
        <div className="flex items-center gap-5">
          {isAdmin && (
            <Link to="/admin" className="text-primary transition-colors hover:text-primary/80">
              <Shield className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          )}
          <Link to="/notifications" className="relative text-foreground transition-colors hover:text-muted-foreground" aria-label="Notifications">
            <Heart className="h-6 w-6" strokeWidth={1.5} />
            <Badge n={unreadNotif} />
          </Link>
          <Link to="/messages" className="relative text-foreground transition-colors hover:text-muted-foreground" aria-label="Messages">
            <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
            <Badge n={unreadMsg} />
          </Link>
        </div>
      </div>
    </header>
  );
}
