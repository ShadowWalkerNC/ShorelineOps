import React from "react";

export type AppleBadgeColor =
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "gray";

export interface AppleBadgeProps {
  color?: AppleBadgeColor;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const colorStyles: Record<AppleBadgeColor, { pill: string; dot: string }> = {
  blue: {
    pill: "bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] border-[#0071e3]/20",
    dot: "bg-[#0071e3]",
  },
  green: {
    pill: "bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158] border-[#34c759]/25",
    dot: "bg-[#34c759]",
  },
  orange: {
    pill: "bg-[#ff9500]/12 text-[#c97400] dark:text-[#ff9f0a] border-[#ff9500]/25",
    dot: "bg-[#ff9500]",
  },
  red: {
    pill: "bg-[#ff3b30]/12 text-[#d70015] dark:text-[#ff453a] border-[#ff3b30]/25",
    dot: "bg-[#ff3b30]",
  },
  purple: {
    pill: "bg-[#af52de]/12 text-[#8944ab] dark:text-[#bf5af2] border-[#af52de]/25",
    dot: "bg-[#af52de]",
  },
  gray: {
    pill: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700",
    dot: "bg-slate-400",
  },
};

export const AppleBadge: React.FC<AppleBadgeProps> = ({
  color = "blue",
  dot = false,
  children,
  className = "",
}) => {
  const styles = colorStyles[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight border select-none ${styles.pill} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      <span>{children}</span>
    </span>
  );
};

export default AppleBadge;
