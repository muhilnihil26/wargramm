import { cn } from "@/lib/utils";

interface BrandTextProps {
  children?: React.ReactNode;
  className?: string;
  /** When true, applies a brand gradient text fill. */
  gradient?: boolean;
}

/**
 * Calligraphy-styled WarGram wordmark. Uses the `font-brand` family which is
 * mapped to "Great Vibes" (cursive) loaded from Google Fonts in index.css.
 * Responsive by default — pair with text-* utility classes to size it.
 */
export function BrandText({ children = "WarGram", className, gradient = true }: BrandTextProps) {
  return (
    <span
      className={cn(
        "font-brand leading-tight tracking-tight inline-block align-baseline",
        // Paint the gradient INSIDE the letters only — no square background, no boxed shadow.
        gradient
          ? "bg-clip-text text-transparent gradient-brand"
          : "",
        className,
      )}
      style={{
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        // Soft glow that follows the letter shapes (not a rectangle behind them)
        filter: gradient ? "drop-shadow(0 1px 2px hsl(var(--primary) / 0.35))" : undefined,
        // Ensures the gradient repaints per line on wraps instead of one big box
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
      } as React.CSSProperties}
    >
      {children}
    </span>
  );
}
