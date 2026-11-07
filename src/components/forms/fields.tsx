"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldChromeProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (describedBy: string | undefined) => ReactNode;
};

const describe = (id: string, hint: ReactNode, error: ReactNode) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

const FieldChrome = ({ id, label, hint, error, className, children }: FieldChromeProps) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    {hint && (
      <p id={`${id}-hint`} className="text-muted-foreground -mt-1 text-sm">
        {hint}
      </p>
    )}
    {children(describe(id, hint, error))}
    {error && (
      <p id={`${id}-error`} className="text-destructive text-sm">
        {error}
      </p>
    )}
  </div>
);

/** A label with a muted "(optional)" after it. */
export const OptionalLabel = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("Forms");

  return (
    <>
      {children} <span className="text-muted-foreground font-normal">({t("optional")})</span>
    </>
  );
};

type TextareaFieldProps = ComponentProps<"textarea"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export const TextareaField = ({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: TextareaFieldProps) => (
  <FieldChrome id={id} label={label} hint={hint} error={error} className={className}>
    {(describedBy) => (
      <Textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="bg-background min-h-36 scroll-mt-32 px-3 py-2.5 md:text-base"
        {...props}
      />
    )}
  </FieldChrome>
);

type SelectFieldProps = ComponentProps<"select"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: { value: string; label: string }[];
};

export const SelectField = ({
  id,
  label,
  hint,
  error,
  options,
  className,
  ...props
}: SelectFieldProps) => (
  <FieldChrome id={id} label={label} hint={hint} error={error} className={className}>
    {(describedBy) => (
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="border-input bg-background focus-visible:border-primary focus-visible:ring-primary/25 aria-invalid:border-destructive min-h-11 w-full cursor-pointer scroll-mt-32 appearance-none rounded-lg border py-2 pr-10 pl-3 text-base transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
    )}
  </FieldChrome>
);

type ChoiceFieldProps = {
  name: string;
  type: "radio" | "checkbox";
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: { value: string; label: string }[];
  inputProps: Omit<ComponentProps<"input">, "type" | "value" | "id">;
  className?: string;
};

/** Element id of a choice field's first option, which the error summary links to. */
export const choiceId = (name: string, value: string) => `${name}-${value}`;

/** Radio buttons or checkboxes as tappable cards in a fieldset, with optional hint and error. */
export const ChoiceField = ({
  name,
  type,
  legend,
  hint,
  error,
  options,
  inputProps,
  className,
}: ChoiceFieldProps) => {
  const describedBy = describe(name, hint, error);

  return (
    <fieldset aria-describedby={describedBy} className={cn("flex flex-col gap-2", className)}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {hint && (
        <p id={`${name}-hint`} className="text-muted-foreground -mt-1 text-sm">
          {hint}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "border-input bg-background hover:border-primary has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:outline-ring has-checked:ring-primary flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-[background-color,border-color] duration-150 has-checked:ring-1 has-focus-visible:outline-3 has-focus-visible:outline-offset-2",
              error && "border-destructive",
            )}
          >
            <input
              {...inputProps}
              id={choiceId(name, option.value)}
              type={type}
              value={option.value}
              aria-invalid={error ? true : undefined}
              className="accent-primary mt-0.5 size-4 shrink-0 scroll-mt-40"
            />
            <span className="leading-snug">{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
};
