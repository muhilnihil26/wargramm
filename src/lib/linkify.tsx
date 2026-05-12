import React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const URL_RE = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;

/** Hosts that should open inside the app instead of a new tab. */
const APP_HOSTS = new Set<string>([
  "wargram.app",
  "muhilsiddhesh.in",
]);

function isAppLink(href: string): { internal: boolean; path: string } {
  try {
    const u = new URL(href);
    const sameOrigin = typeof window !== "undefined" && u.origin === window.location.origin;
    const knownHost = APP_HOSTS.has(u.hostname);
    if (sameOrigin || knownHost) {
      return { internal: true, path: u.pathname + u.search + u.hash || "/" };
    }
  } catch {}
  return { internal: false, path: href };
}

/** Render text with embedded URLs as clickable anchors. WarGram URLs stay in-app. */
export function linkify(text: string): React.ReactNode[] {
  if (!text) return [text];
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      const { internal, path } = isAppLink(href);
      if (internal) {
        return (
          <Link
            key={i}
            to={path}
            className="underline underline-offset-2 break-all hover:opacity-80 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              toast.success("Opened in WarGram", { description: path });
            }}
          >
            {part}
          </Link>
        );
      }
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 break-all hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function containsUrl(text: string): boolean {
  return URL_RE.test(text);
}

/** Pull the first WarGram-internal path out of arbitrary text, if any. */
export function extractAppLink(text: string): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  if (!match) return null;
  for (const raw of match) {
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    const { internal, path } = isAppLink(href);
    if (internal) return path;
  }
  return null;
}
