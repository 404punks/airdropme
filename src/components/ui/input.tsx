import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-2xl border border-line bg-ink/70 px-4 text-sm text-mist placeholder:text-mute/70",
        className,
      )}
      {...props}
    />
  );
}
