import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const baseClasses =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-60";

const variantClasses: Record<Variant, string> = {
  default: "bg-orange-500 text-white shadow-soft hover:bg-orange-500/90",
  outline:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 shadow-sm",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-900",
  secondary:
    "bg-violet-600 text-white shadow-soft hover:bg-violet-600/90"
};

const sizeClasses: Record<Size, string> = {
  default: "h-10 px-6",
  sm: "h-8 px-4 text-xs",
  lg: "h-12 px-7 text-base",
  icon: "h-10 w-10"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

