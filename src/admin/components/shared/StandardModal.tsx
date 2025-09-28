import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  headerActions?: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl'
};

export function StandardModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  headerActions
}: StandardModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${sizeClasses[size]} max-h-[90vh] overflow-y-auto bg-creme border-coyote shadow-xl`}>
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-coyote">
          <div>
            <DialogTitle className="text-lg font-semibold text-dark">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </DialogDescription>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {headerActions}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0 text-dark hover:bg-coyote/30"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {children}
        </div>
        
        {footer && (
          <div className="flex justify-end space-x-2 pt-4 border-t border-coyote">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
