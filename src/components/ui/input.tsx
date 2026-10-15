import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-none border border-line bg-ink px-4 text-base text-mist outline-none transition placeholder:text-mute/80 focus:border-blue sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
