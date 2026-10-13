"use client";

import { useEffect, useState } from "react";

export function Countdown({ target }: { target: string | null }) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!target) {
      setLabel("No deadline configured");
      return;
    }
    const tick = () => {
      const delta = new Date(target).getTime() - Date.now();
      if (Number.isNaN(delta)) {
        setLabel("Invalid date");
        return;
      }
      if (delta <= 0) {
        setLabel("Deadline reached");
        return;
      }
      const days = Math.floor(delta / 86_400_000);
      const hours = Math.floor((delta % 86_400_000) / 3_600_000);
      const minutes = Math.floor((delta % 3_600_000) / 60_000);
      setLabel(`${days}d ${hours}h ${minutes}m`);
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [target]);

  return <p className="font-display text-3xl text-acid">{label}</p>;
}
