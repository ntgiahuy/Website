import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-8 w-full rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
