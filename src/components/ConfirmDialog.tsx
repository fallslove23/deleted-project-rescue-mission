import { ReactNode } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConfirmDialogAction = {
  label: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: ButtonProps['variant'];
  disabled?: boolean;
  className?: string;
  closeOnClick?: boolean;
};

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  primaryAction: ConfirmDialogAction;
  secondaryAction?: ConfirmDialogAction;
  contentClassName?: string;
  footerClassName?: string;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  primaryAction,
  secondaryAction,
  contentClassName,
  footerClassName,
}: ConfirmDialogProps) => {
  const handlePrimaryClick = async () => {
    try {
      await primaryAction.onClick?.();
      if (primaryAction.closeOnClick) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('ConfirmDialog primaryAction failed', error);
    }
  };

  const handleSecondaryClick = () => {
    secondaryAction?.onClick?.();
    if (secondaryAction?.closeOnClick ?? true) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {description && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{description}</div>
        )}

        <DialogFooter className={cn('gap-2', footerClassName)}>
          <Button
            type="button"
            variant={secondaryAction?.variant ?? 'outline'}
            disabled={secondaryAction?.disabled}
            className={secondaryAction?.className}
            onClick={handleSecondaryClick}
          >
            {secondaryAction?.label ?? '취소'}
          </Button>
          <Button
            type="button"
            variant={primaryAction.variant ?? 'default'}
            disabled={primaryAction.disabled}
            className={primaryAction.className}
            onClick={handlePrimaryClick}
          >
            {primaryAction.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
