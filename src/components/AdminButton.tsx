"use client";

// Single source of truth for admin panel button styling. Changing the
// theme in the future (colors, radius, etc.) only requires editing here
// — every primary/secondary/destructive button in the admin panel reuses
// this instead of each file having its own copy of the Tailwind classes.

type Variant = "primary" | "secondary" | "destructive";
type Size = "md" | "sm";

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-[#1E3A5F] text-white hover:bg-[#1E3A5F]/90",
  secondary: "border border-gray-300 text-gray-600 hover:bg-gray-50",
  destructive: "bg-ember text-white hover:bg-ember/90"
};

const SIZE_STYLES: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs"
};

export default function AdminButton({
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  onClick,
  className = "",
  children
}: {
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md font-semibold whitespace-nowrap disabled:opacity-60 transition-colors ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
