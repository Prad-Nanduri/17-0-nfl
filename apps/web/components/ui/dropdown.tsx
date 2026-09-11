'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, CaretDown } from '@phosphor-icons/react';
import { Button } from './button';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface DropdownProps {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

/** A single-choice menu with keyboard navigation; label names the setting, options name values. */
export function Dropdown({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
}: DropdownProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="ghost"
          size="small"
          disabled={disabled}
          aria-label={`${label}: ${selected?.label ?? value}`}
        >
          {selected?.label ?? value}
          <CaretDown size={14} aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          collisionPadding={20}
          className="panel-enter z-dropdown min-w-48 max-w-[calc(100vw-2.5rem)] rounded-control border border-line bg-surface p-1.5 shadow-floating"
        >
          <Menu.Label className="px-3 py-2 text-caption text-muted">{label}</Menu.Label>
          <Menu.RadioGroup value={value} onValueChange={onValueChange}>
            {options.map((option) => (
              <Menu.RadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled ?? false}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-6 rounded-badge px-3 text-small outline-none transition-colors duration-fast data-[highlighted]:bg-subtle data-[highlighted]:text-action data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              >
                {option.label}
                <Menu.ItemIndicator>
                  <Check size={16} aria-hidden="true" />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
