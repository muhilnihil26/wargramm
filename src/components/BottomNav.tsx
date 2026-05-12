import { Home, Search, PlusSquare, Film, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAppSettings } from "@/hooks/useAppSettings";

const navItems = [
  { to: "/", icon: Home, label: "Home", flag: null, tour: "nav-home" },
  { to: "/explore", icon: Search, label: "Explore", flag: "explore", tour: "nav-explore" },
  { to: "/create", icon: PlusSquare, label: "Create", flag: null, tour: "nav-create" },
  { to: "/reels", icon: Film, label: "Reels", flag: "reels", tour: "nav-reels" },
  { to: "/profile", icon: User, label: "Profile", flag: null, tour: "nav-profile" },
];

export function BottomNav() {
  const { flag } = useAppSettings();
  const visibleItems = navItems.filter((i) => !i.flag || flag(i.flag));
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] lg:bottom-auto lg:right-auto lg:top-0 lg:h-screen lg:w-24 lg:border-r lg:border-t-0 lg:pb-0">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 lg:h-full lg:flex-col lg:justify-center lg:gap-3 lg:px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-tour={item.tour}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl p-2 transition-colors lg:w-full lg:px-2 lg:py-3 ${
                isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-6 w-6" strokeWidth={1.5} />
            <span className="hidden text-[11px] font-semibold lg:block">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
