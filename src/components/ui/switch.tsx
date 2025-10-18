"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Track: explicit ON/OFF colors using theme tokens
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all outline-none",
        // Visible borders and backgrounds for both states
        "border data-[state=unchecked]:bg-[var(--color-coyote)] data-[state=checked]:bg-[var(--color-canyon)] border-[var(--color-coyote)]",
        // Focus ring in accent color
        "focus-visible:ring-[3px] focus-visible:ring-[var(--color-canyon)]/50",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // Knob uses light background and translates clearly between states
          "pointer-events-none block size-4 rounded-full ring-0 transition-transform",
          "bg-[var(--color-creme-light)]",
          "data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
