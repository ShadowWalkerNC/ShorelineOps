import React, { type HTMLAttributes } from "react";

export type AppleCardVariant = "glass" | "grouped" | "inset" | "elevated";

export interface AppleCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AppleCardVariant;
  header?: React.ReactNode;
  subtitle?: string;
  footer?: React.ReactNode;
}

const variantStyles: Record<AppleCardVariant, string> = {
  glass:
    "backdrop-blur-xl bg-white/75 dark:bg-zinc-900/75 border border-black/5 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
  grouped:
    "bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm",
  inset:
    "bg-slate-50/80 dark:bg-zinc-950/80 border border-slate-200/60 dark:border-zinc-800/60",
  elevated:
    "bg-white dark:bg-zinc-900 shadow-[0_12px_32px_rgba(0,0,0,0.08)] border border-black/5 dark:border-white/10",
};

export const AppleCard: React.FC<AppleCardProps> = ({
  variant = "glass",
  header,
  subtitle,
  footer,
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl transition-all duration-200 overflow-hidden ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {(header || subtitle) && (
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/10">
          {header && typeof header === "string" ? (
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              {header}
            </h3>
          ) : (
            header
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 tracking-tight">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-zinc-950/50 border-t border-black/5 dark:border-white/10 text-xs text-slate-500 dark:text-zinc-400">
          {footer}
        </div>
      )}
    </div>
  );
};

export default AppleCard;
