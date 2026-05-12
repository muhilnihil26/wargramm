import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import wargramLogo from "@/assets/wargram-logo.png";

/**
 * Cold-load splash. Shows once per page load (NOT route change).
 * Auto-dismisses after ~1.8s.
 */
export function IntroSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-background"
        >
          {/* Animated gradient orbs */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.5 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute h-72 w-72 rounded-full bg-primary/30 blur-3xl"
          />
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.35 }}
            transition={{ duration: 1.6, delay: 0.15, ease: "easeOut" }}
            className="absolute -bottom-10 right-10 h-56 w-56 rounded-full bg-primary/40 blur-3xl"
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-primary/40 blur-2xl"
            />
            <img src={wargramLogo} alt="WarGram" className="relative h-28 w-28 drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="relative mt-6 font-brand text-6xl sm:text-7xl text-foreground"
          >
            WarGram
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="relative mt-2 text-[11px] font-bold tracking-[0.3em] text-muted-foreground uppercase"
          >
            Made by <span className="text-primary">War.Dev</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
