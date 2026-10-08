"use client";

import * as RadixSelect from "@radix-ui/react-select";

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Выбери",
  ariaLabel,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger className="select-trigger" aria-label={ariaLabel ?? placeholder}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="select-chevron">▾</RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content" position="popper" sideOffset={6}>
          <RadixSelect.Viewport>
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} className="select-item">
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
