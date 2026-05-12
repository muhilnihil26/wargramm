import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  verified?: boolean | null;
  className?: string;
  size?: number;
}

/** Small blue check shown next to verified usernames. */
export function VerifiedBadge({ verified, className = "", size = 14 }: VerifiedBadgeProps) {
  if (!verified) return null;
  return (
    <BadgeCheck
      className={`inline-block text-primary fill-primary/20 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Verified"
    />
  );
}
