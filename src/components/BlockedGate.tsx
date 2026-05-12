import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isUuid } from "@/lib/ids";

export function BlockedGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [block, setBlock] = useState<{ reason: string | null } | null>(null);

  useEffect(() => {
    if (!user || !isUuid(user.id)) { setBlock(null); return; }
    supabase.from("user_blocks").select("reason").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setBlock(data ? { reason: (data as any).reason } : null));
  }, [user]);

  if (!block) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Account suspended</h1>
        <p className="text-sm text-muted-foreground">
          {block.reason || "Your account has been blocked by an administrator. Please contact support if you believe this is a mistake."}
        </p>
        <button onClick={() => signOut?.()} className="rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground">
          Sign out
        </button>
      </div>
    </div>
  );
}
