import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export const workspaceEase = [0.22, 1, 0.36, 1] as const;

/** Key by pathname, so editing filters never animates or replaces a form. */
export function PageMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: workspaceEase }}
    >
      {children}
    </motion.div>
  );
}

/** Animate the measured fill with a transform, never invent progress. */
export function ProgressFill({ value, className }: { value: number; className: string }) {
  const reduced = useReducedMotion();
  const fraction = Math.max(0, Math.min(100, value)) / 100;
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ scaleX: fraction }}
      transition={{ duration: reduced ? 0 : 0.35, ease: workspaceEase }}
      style={{ width: "100%", transformOrigin: "left" }}
    />
  );
}

/** Decorative activity, separate from the real progressbar and phase labels. */
export function ScanActivity() {
  const reduced = useReducedMotion();
  return (
    <div className="scan-activity" aria-hidden="true">
      <svg viewBox="0 0 480 56" preserveAspectRatio="none">
        <path d="M12 28H468" stroke="var(--ws-border)" fill="none" />
        {!reduced && (
          <motion.path
            d="M12 28H468"
            stroke="var(--ws-text-secondary)"
            strokeWidth="2"
            strokeDasharray="28 428"
            fill="none"
            initial={{ strokeDashoffset: 456 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
          />
        )}
        {[12, 240, 468].map((x, index) => (
          <motion.rect
            key={x}
            x={x - 5}
            y="23"
            width="10"
            height="10"
            fill="var(--ws-surface)"
            stroke="var(--ws-text-secondary)"
            animate={reduced ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
            transition={
              reduced ? { duration: 0 } : { duration: 2.2, delay: index * 0.35, repeat: Infinity }
            }
          />
        ))}
      </svg>
      <div>
        <span>Source</span>
        <span>Evidence</span>
        <span>Inventory</span>
      </div>
    </div>
  );
}
