import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  live: "bg-acid/15 text-acid",
  cached: "bg-warn/15 text-warn",
  unavailable: "bg-danger/15 text-danger",
  demo: "bg-violet/20 text-violet",
  neutral: "bg-panel2 text-mute",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}
