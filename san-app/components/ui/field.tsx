import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <span className="text-[11px] text-zinc-400 leading-tight">{label}</span>
      {children}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 min-w-0",
        className,
      )}
    >
      <h2 className="mb-2 text-sm font-semibold text-sky-300">{title}</h2>
      {children}
    </section>
  );
}
