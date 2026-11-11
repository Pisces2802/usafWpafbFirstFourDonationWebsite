import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TextFieldProps = ComponentProps<"input"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** A control inside the end of the input, like a show-password button. */
  endSlot?: ReactNode;
};

export const TextField = ({
  id,
  label,
  hint,
  error,
  endSlot,
  className,
  ...props
}: TextFieldProps) => {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted-foreground -mt-1 text-sm">
          {hint}
        </p>
      )}
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("bg-background h-11 scroll-mt-32 px-3 md:text-base", endSlot && "pr-12")}
          {...props}
        />
        {endSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-0.5">{endSlot}</div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
};
