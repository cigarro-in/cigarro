import * as React from "react";
import { Drawer } from "vaul";
import { cn } from "./utils";
import { X } from "lucide-react";

export interface BottomDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
}

export function BottomDrawer({
  open,
  onOpenChange,
  trigger,
  children,
  title,
  description,
  className,
  contentClassName,
  footer,
  showCloseButton = false,
}: BottomDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[9999] backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "bg-creme flex flex-col rounded-t-[20px] border-t border-coyote mt-24 fixed bottom-0 left-0 right-0 z-[10000] max-h-[96%] outline-none shadow-[0_-5px_40px_rgba(0,0,0,0.1)]",
            className
          )}
        >
          <div className={cn("p-4 bg-creme rounded-t-[20px] flex-1 flex flex-col max-h-full overflow-hidden", contentClassName)}>
            {/* Handle */}
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-coyote/40 mb-6" />
            
            {/* Header */}
            {(title || description || showCloseButton) && (
                <div className="mb-6 flex items-start justify-between">
                    <div className="flex-1">
                        {title && <Drawer.Title className="text-2xl font-serif text-dark mb-2">{title}</Drawer.Title>}
                        {description && <Drawer.Description className="text-muted-foreground font-sans text-sm">{description}</Drawer.Description>}
                    </div>
                    {showCloseButton && (
                        <Drawer.Close asChild>
                            <button className="p-2 -mr-2 hover:bg-coyote/10 rounded-full transition-colors text-dark/60">
                                <X size={20} />
                            </button>
                        </Drawer.Close>
                    )}
                </div>
            )}
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto -mx-4 px-4 scrollbar-hide">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="mt-6 pt-4 border-t border-coyote/20 flex-shrink-0">
                    {footer}
                </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
