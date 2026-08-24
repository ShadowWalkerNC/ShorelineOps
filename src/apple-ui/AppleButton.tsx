import React, { type ButtonHTMLAttributes } from "react";

export type AppleButtonVariant =
  | "primary"     // System filled blue (#0071e3)
  | "secondary"   // System filled gray
  | "tinted"      // Translucent tinted blue
  | "plain"       // Borderless text button
  | "glass"       // Vibrant blur glass button
  | "destructive" // System filled red
  | "success";    // System filled green

export type AppleButtonSize = "sm" | "md" | "lg" | "capsule";

export interface AppleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppleButtonVariant;
  size?: AppleButtonSize;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<AppleButtonVariant, string> = {
  primary:
    "bg-[#0071e3] text-white hover:bg-[#0077ED] active:bg-[#0062c4] shadow-sm",
  secondary:
    "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700",
  tinted:
    "bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] hover:bg-[#0071e3]/15",
  plain:
    "bg-transparent text-[#0071e3] dark:text-[#2997ff] hover:underline shadow-none",
  glass:
    "backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white hover:bg-white/85 dark:hover:bg-zinc-800/85 shadow-sm",
  destructive:
    "bg-[#ff3b30] text-white hover:bg-[#e0352a] active:bg-[#c92f25]",
  success:
    "bg-[#34c759] text-white hover:bg-[#2eb34f] active:bg-[#289e45]",
};

const sizeStyles: Record<AppleButtonSize, string> = {
  sm: "text-xs font-semibold px-3 py-1.5 rounded-lg gap-1.5 h-8",
  md: "text-sm font-semibold px-4 py-2 rounded-xl gap-2 h-10",
  lg: "text-base font-semibold px-6 py-3 rounded-2xl gap-2.5 h-12",
  capsule: "text-sm font-semibold px-5 py-2.5 rounded-full gap-2 h-10",
};

export const AppleButton: React.FC<AppleButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center select-none font-[-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif] tracking-tight transition-all duration-150 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default AppleButton;
