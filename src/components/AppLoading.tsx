import wargramLogo from "@/assets/wargram-logo.png";

export function AppLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full gradient-story opacity-80 blur-md animate-pulse" />
          <div className="absolute inset-1 rounded-full gradient-story animate-spin" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-background">
            <img src={wargramLogo} alt="" className="h-10 w-10 rounded-xl object-contain" />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
