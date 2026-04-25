"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const texts = ["Hot Takes", "Live Stakes", "Real Wins"];

export default function RotatingText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, 2100);

    return () => clearInterval(timer);
  }, []);

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-2 md:gap-3">
      <span>Turn Opinions Into</span>
      <br/>
      <AnimatePresence mode="wait">
        <motion.span
          key={texts[index]}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-120%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          className="inline-block overflow-hidden rounded-xl bg-[var(--primary)] px-3 py-1 text-white md:px-4"
        >
          {texts[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
