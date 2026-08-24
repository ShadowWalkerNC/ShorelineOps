import React from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface AppleSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function AppleSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: AppleSegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex p-1 bg-slate-200/70 dark:bg-zinc-800/80 rounded-xl backdrop-blur-md border border-black/5 dark:border-white/5 ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg tracking-tight transition-all duration-150 select-none ${
              isSelected
                ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? "bg-[#0071e3] text-white"
                    : "bg-slate-300 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AppleSegmentedControl;
