import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "quiet";

const STYLES: Record<Variant, string> = {
  primary: "bg-brand text-white border-brand hover:bg-brand-dark hover:border-brand-dark",
  secondary: "bg-surface text-ink border-line hover:border-muted hover:bg-brand-soft",
  danger: "bg-surface text-danger border-danger hover:bg-red-50",
  quiet: "bg-transparent text-brand border-transparent hover:bg-brand-soft underline-offset-2 hover:underline",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean };

/** Every button is at least 44px tall with a visible text label. */
export function Button({ variant = "secondary", small = false, className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] font-semibold transition-colors disabled:opacity-50 ${
        small ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-base"
      } ${STYLES[variant]} ${className}`}
      {...rest}
    />
  );
}
