import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  className,
  unit,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Đơn vị hiển thị sau ô nhập (vd. mm). */
  unit?: string;
  /** Ô nhập rộng hơn (tên, ghi chú…). */
  wide?: boolean;
}) {
  return (
    <label
      className={cn(
        "grid w-full min-w-0 items-center gap-x-2 gap-y-1",
        /* ≤760px: stack 1 cột, input full width */
        "grid-cols-1",
        "min-[761px]:grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
    >
      <span className="min-w-0 text-[12px] leading-tight text-zinc-400">{label}</span>
      <div className="flex min-w-0 w-full items-center justify-stretch gap-1.5 min-[761px]:w-auto min-[761px]:justify-end">
        <div
          className={cn(
            "min-w-0 w-full [&_input]:w-full [&_select]:w-full",
            wide
              ? "min-[761px]:w-[9.5rem]"
              : "min-[761px]:w-[5.5rem]",
          )}
        >
          {children}
        </div>
        {unit ? (
          <span className="w-7 shrink-0 text-[12px] text-zinc-400">{unit}</span>
        ) : (
          <span className="hidden w-7 shrink-0 min-[761px]:block" aria-hidden />
        )}
      </div>
    </label>
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
        "min-w-0 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3",
        className,
      )}
    >
      <h2 className="mb-2 text-sm font-semibold text-sky-300">{title}</h2>
      {children}
    </section>
  );
}
