import { X } from "lucide-react";

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Tap/click an avatar to view it full-size. Click backdrop or X to close. */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt || "Photo"}
        className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
