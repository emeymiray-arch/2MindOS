"use client";

import * as RadixDialog from "@radix-ui/react-dialog";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content className="dialog-content panel">
          <div className="dialog-head">
            <RadixDialog.Title className="dialog-title">{title}</RadixDialog.Title>
            <RadixDialog.Close className="plan-icon-btn" aria-label="Закрыть">
              ×
            </RadixDialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
