"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ============================================================
// CACI Brand Button
// Primary: CACI Red bg, white text, 48px height (mobile), squish on tap
// Secondary: CACI Blue outline, transparent bg
// ============================================================

type CACIButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type CACIButtonSize = "default" | "lg" | "sm" | "icon";

export interface CACIButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CACIButtonVariant;
  size?: CACIButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<CACIButtonVariant, string> = {
  primary:
    "bg-caci-red text-white hover:bg-caci-red-light active:bg-caci-red-dim shadow-sm",
  secondary:
    "border-[1.5px] border-caci-blue text-caci-blue bg-transparent hover:bg-caci-blue-bg active:bg-[#b3d0ff]",
  ghost:
    "bg-transparent text-caci-blue hover:bg-caci-blue-bg active:bg-[#b3d0ff]",
  danger:
    "bg-caci-red-bg text-caci-red border border-caci-red hover:bg-[#ffe0e6] active:bg-[#ffd0d8]",
};

const sizeClasses: Record<CACIButtonSize, string> = {
  default: "h-12 px-4 text-[16px]",
  lg: "h-14 px-6 text-[16px]",
  sm: "h-9 px-3 text-[14px]",
  icon: "size-12 p-0",
};

export const CACIButton = React.forwardRef<HTMLButtonElement, CACIButtonProps>(
  (
    { className, variant = "primary", size = "default", loading, leftIcon, rightIcon, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all",
          "tap-squish outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-caci-blue",
          "disabled:pointer-events-none disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin-caci" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  },
);
CACIButton.displayName = "CACIButton";

// ============================================================
// CACI Brand Input — 16px font (iOS zoom prevention), focus ring CACI Blue
// ============================================================

export interface CACIInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerClassName?: string;
}

export const CACIInput = React.forwardRef<HTMLInputElement, CACIInputProps>(
  ({ className, label, error, leftIcon, rightAdornment, containerClassName, id, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id || reactId;
    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-[14px] font-medium text-n700">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-n400">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-12 rounded-lg border bg-white px-3 text-[16px] text-n900 placeholder:text-n300",
              "transition-input outline-none",
              "focus:border-caci-blue focus:ring-2 focus:ring-caci-blue/20",
              leftIcon && "pl-10",
              rightAdornment && "pr-12",
              error ? "border-caci-red focus:border-caci-red focus:ring-caci-red/20" : "border-n100",
              className,
            )}
            {...props}
          />
          {rightAdornment && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              {rightAdornment}
            </span>
          )}
        </div>
        {error && (
          <p className="text-[14px] text-caci-red animate-fade-in">{error}</p>
        )}
      </div>
    );
  },
);
CACIInput.displayName = "CACIInput";

// ============================================================
// CACI Textarea
// ============================================================

export interface CACITextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
}

export const CACITextarea = React.forwardRef<HTMLTextAreaElement, CACITextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const reactId = React.useId();
    const taId = id || reactId;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={taId} className="block text-[14px] font-medium text-n700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          className={cn(
            "w-full rounded-lg border bg-white p-3 text-[16px] text-n900 placeholder:text-n300",
            "transition-input outline-none min-h-[96px] resize-y",
            "focus:border-caci-blue focus:ring-2 focus:ring-caci-blue/20",
            error ? "border-caci-red" : "border-n100",
            className,
          )}
          {...props}
        />
        {error && <p className="text-[14px] text-caci-red">{error}</p>}
      </div>
    );
  },
);
CACITextarea.displayName = "CACITextarea";

// ============================================================
// CACI Select (native, styled)
// ============================================================

export interface CACISelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
}

export const CACISelect = React.forwardRef<HTMLSelectElement, CACISelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const reactId = React.useId();
    const selId = id || reactId;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selId} className="block text-[14px] font-medium text-n700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selId}
          className={cn(
            "w-full h-12 rounded-lg border bg-white px-3 text-[16px] text-n900",
            "transition-input outline-none cursor-pointer appearance-none",
            "focus:border-caci-blue focus:ring-2 focus:ring-caci-blue/20",
            "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236e7681%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_12px_center] pr-9",
            error ? "border-caci-red" : "border-n100",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[14px] text-caci-red">{error}</p>}
      </div>
    );
  },
);
CACISelect.displayName = "CACISelect";

// ============================================================
// CACI Brand Card — white, 8px radius, 1px n100 border, hover lift on desktop
// ============================================================

export interface CACICardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "sm" | "default" | "lg" | "none";
  as?: "div" | "button";
}

export function CACICard({
  className,
  children,
  hover = false,
  padding = "default",
  as: Comp = "div",
  ...props
}: CACICardProps) {
  const padClass = {
    none: "",
    sm: "p-3",
    default: "p-4",
    lg: "p-5 sm:p-6",
  }[padding];
  return (
    <Comp
      className={cn(
        "bg-white rounded-lg border border-n100",
        hover && "card-hover cursor-pointer text-left w-full block",
        padClass,
        className,
      )}
      {...(props as any)}
    >
      {children}
    </Comp>
  );
}

// ============================================================
// CACI Status & Role Badges
// ============================================================

export function MembershipStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#dafbe1] text-[#1a7f37]",
    inactive: "bg-n100 text-n500",
    visitor: "bg-[#fff8c5] text-[#9a6700]",
  };
  const labels: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    visitor: "Visitor",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        styles[status] || styles.inactive,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {labels[status] || status}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-caci-blue-bg text-caci-blue",
    member: "bg-n50 text-n700",
  };
  const labels: Record<string, string> = {
    admin: "Admin",
    member: "Member",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        styles[role] || styles.member,
      )}
    >
      {labels[role] || role}
    </span>
  );
}

export function TargetingBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    assembly: "bg-caci-blue-bg text-caci-blue",
    group: "bg-[#dafbe1] text-[#1a7f37]",
    members: "bg-[#fff8c5] text-[#9a6700]",
  };
  const labels: Record<string, string> = {
    assembly: "Assembly-wide",
    group: "Group",
    members: "Selected Members",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium", styles[mode])}>
      {labels[mode] || mode}
    </span>
  );
}

// ============================================================
// CACI Logo Mark — red shield with cross
// ============================================================

export function CaciLogo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("caci-shield flex items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size }}
      aria-label="CACI Hub logo"
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="7" y1="9.5" x2="17" y2="9.5" />
      </svg>
    </div>
  );
}

// ============================================================
// CACI Avatar (initials fallback)
// ============================================================

export function CaciAvatar({
  name,
  photoUrl,
  size = 40,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const colors = [
    "bg-caci-blue-bg text-caci-blue",
    "bg-caci-red-bg text-caci-red",
    "bg-[#dafbe1] text-[#1a7f37]",
    "bg-[#fff8c5] text-[#9a6700]",
    "bg-[#f6f8fa] text-n700",
  ];
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const colorClass = colors[hash % colors.length];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-[14px]",
        colorClass,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// ============================================================
// CACI Section Heading
// ============================================================

export function SectionHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h2 className="text-[18px] font-semibold text-n900">{title}</h2>
      {action}
    </div>
  );
}

// ============================================================
// CACI Empty State
// ============================================================

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      {icon && (
        <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-n50 text-n400">
          {icon}
        </div>
      )}
      <p className="text-[16px] font-semibold text-n700">{title}</p>
      {description && <p className="mt-1 text-[14px] text-n400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================
// CACI Skeleton
// ============================================================

export function CACISkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-caci rounded-md", className)} />;
}

// ============================================================
// CACI Stat Tile
// ============================================================

export function StatTile({
  label,
  value,
  icon,
  accent = "blue",
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: "red" | "blue" | "green" | "amber";
  trend?: { value: string; positive?: boolean };
  onClick?: () => void;
}) {
  const accentClasses = {
    red: "bg-caci-red-bg text-caci-red",
    blue: "bg-caci-blue-bg text-caci-blue",
    green: "bg-[#dafbe1] text-[#1a7f37]",
    amber: "bg-[#fff8c5] text-[#9a6700]",
  }[accent];
  return (
    <CACICard hover={!!onClick} padding="default" onClick={onClick} className="flex items-start gap-3">
      {icon && (
        <div className={cn("flex size-10 items-center justify-center rounded-lg shrink-0", accentClasses)}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-n400 uppercase tracking-wide">{label}</p>
        <p className="text-[24px] font-bold text-n900 leading-tight mt-0.5">{value}</p>
        {trend && (
          <p className={cn("text-[12px] mt-0.5", trend.positive ? "text-[#1a7f37]" : "text-caci-red")}>
            {trend.value}
          </p>
        )}
      </div>
    </CACICard>
  );
}
