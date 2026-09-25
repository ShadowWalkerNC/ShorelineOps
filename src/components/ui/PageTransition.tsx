import React from 'react'
import { cn } from '@/lib/utils'

interface PageTransitionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

/**
 * Apple HIG-style page and section transition wrapper.
 * Provides a subtle 180ms ease-out opacity fade and 4px vertical rise.
 * Respects `prefers-reduced-motion` for accessibility and low-powered kiosk hardware.
 */
export default function PageTransition({ children, className, ...props }: PageTransitionProps) {
  return (
    <div
      className={cn(
        'w-full animate-in fade-in-50 slide-in-from-bottom-1 duration-200 fill-mode-both ease-out',
        'motion-reduce:animate-none motion-reduce:transition-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
