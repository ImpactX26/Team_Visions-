// Renders a color-coded badge for risk severity levels.
// Severity stays legible without decorative animation.
import { memo } from "react";

interface Props {
  label: string;
  score?: number;
  size?: "sm" | "md";
}

const CLASS: Record<string, string> = {
  CRITICAL: "risk-critical",
  HIGH: "risk-high",
  MEDIUM: "risk-medium",
  LOW: "risk-low",
};

const SIZE_CLASS: Record<string, string> = {
  sm: "risk-badge-sm",
  md: "",
};

export const RiskBadge = memo(function RiskBadge({ label, score, size = "md" }: Props) {
  const cls = CLASS[label] || "";
  return (
    <span
      className={`risk-badge ${cls} ${SIZE_CLASS[size]}`}
      title={score != null ? `Priority score: ${score}` : undefined}
    >
      <span className="dot" aria-hidden="true" />
      {label}
      {score != null ? (size === "sm" ? ` ${score}` : ` (${score})`) : ""}
    </span>
  );
});
