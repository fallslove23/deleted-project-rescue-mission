import { type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';

type ButtonVariant = ButtonProps['variant'];

type ConfirmDialogAction = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: ButtonVariant;
  disabled?: boolean;
};

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  primaryAction: ConfirmDialogAction;
  secondaryAction?: ConfirmDialogAction;
  cancelLabel?: string;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  primaryAction,
  secondaryAction,
  cancelLabel = '취소',
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="touch-friendly">{cancelLabel}</AlertDialogCancel>
          {secondaryAction && (
            <AlertDialogAction asChild>
              <Button
                variant={secondaryAction.variant ?? 'outline'}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                className="touch-friendly"
              >
                {secondaryAction.label}
              </Button>
            </AlertDialogAction>
          )}
          <AlertDialogAction asChild>
            <Button
              variant={primaryAction.variant ?? 'default'}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="touch-friendly"
            >
              {primaryAction.label}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDialog;
