import * as React from "react";
import { cn } from "../../../components/ui/utils";

/**
 * Admin-specific Card components with compact styling and theme colors.
 * Use these in admin pages instead of the base Card components.
 */

function AdminCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-card"
      className={cn(
        "bg-[var(--color-creme-light)] text-[var(--color-dark)] flex flex-col rounded-lg border border-[var(--color-coyote)]/30 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function AdminCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-card-header"
      className={cn(
        "flex flex-col gap-1 px-4 py-3 border-b border-[var(--color-coyote)]/20",
        className,
      )}
      {...props}
    />
  );
}

function AdminCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <h4
      data-slot="admin-card-title"
      className={cn("text-base font-semibold text-[var(--color-dark)]", className)}
      {...props}
    />
  );
}

function AdminCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="admin-card-description"
      className={cn("text-sm text-[var(--color-dark)]/60", className)}
      {...props}
    />
  );
}

function AdminCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-card-content"
      className={cn("px-4 py-3 space-y-3", className)}
      {...props}
    />
  );
}

function AdminCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="admin-card-footer"
      className={cn("flex items-center px-4 py-3 border-t border-[var(--color-coyote)]/20", className)}
      {...props}
    />
  );
}

export {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
  AdminCardContent,
  AdminCardFooter,
};
