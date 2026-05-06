import { forwardRef, type ButtonHTMLAttributes } from "react";

type Size = "lg" | "md" | "sm";
type Variant = "primary" | "secondary" | "ghost" | "dashed";

const sizeClasses: Record<Size, string> = {
  lg: "rounded px-5 py-2.5 text-base font-medium",
  md: "rounded px-4 py-1.5 text-sm font-medium",
  sm: "rounded px-2 py-1 text-xs font-medium uppercase tracking-wider",
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:opacity-90",
  secondary:
    "border border-border bg-overlay-1 text-text-muted hover:border-border-strong hover:text-text",
  ghost: "text-text-muted hover:text-text",
  dashed:
    "w-full border border-dashed border-border bg-overlay-1 text-text-subtle hover:border-border-strong hover:text-text",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = "md", variant = "secondary", className = "", type = "button", ...rest },
  ref
) {
  const classes = [
    "transition disabled:opacity-50 disabled:cursor-not-allowed",
    sizeClasses[size],
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
