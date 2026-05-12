import { useState } from "react";
import { X, Copy, Mail, MessageSquare, Share2, Check } from "lucide-react";
import { toast } from "sonner";

interface InviteSheetProps {
  onClose: () => void;
}

export function InviteSheet({ onClose }: InviteSheetProps) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteText = `Join me on WarGram — a fast new social app. ${inviteUrl}`;

  const copy = async () => {
    await navigator.clipboard.writeText(inviteText);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (!(navigator as any).share) {
      copy();
      return;
    }
    try {
      await (navigator as any).share({
        title: "WarGram",
        text: "Join me on WarGram",
        url: inviteUrl,
      });
    } catch {}
  };

  const mailto = `mailto:?subject=${encodeURIComponent("Join me on WarGram")}&body=${encodeURIComponent(inviteText)}`;
  const sms = `sms:?body=${encodeURIComponent(inviteText)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Invite friends</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-foreground" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
            />
            <button onClick={copy} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground inline-flex items-center gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-lg bg-secondary py-3 hover:bg-secondary/80">
              <MessageSquare className="h-5 w-5 text-foreground" />
              <span className="text-[11px] text-foreground">WhatsApp</span>
            </a>
            <a href={sms} className="flex flex-col items-center gap-1 rounded-lg bg-secondary py-3 hover:bg-secondary/80">
              <MessageSquare className="h-5 w-5 text-foreground" />
              <span className="text-[11px] text-foreground">SMS</span>
            </a>
            <a href={mailto} className="flex flex-col items-center gap-1 rounded-lg bg-secondary py-3 hover:bg-secondary/80">
              <Mail className="h-5 w-5 text-foreground" />
              <span className="text-[11px] text-foreground">Email</span>
            </a>
          </div>

          <button
            onClick={nativeShare}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Share2 className="h-4 w-4" /> Share via…
          </button>
        </div>
      </div>
    </div>
  );
}
