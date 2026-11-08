"use client";

import { CalendarIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "cn";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar, type DateRange } from "./calendar";

/** Props for single-date mode. */
type SingleDatePickerProps = {
  onValueChange: (date: Date | undefined) => void;
  type: "single";
  value: Date | undefined;
  className?: string;
  label?: string;
  labelClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  onBlur?: () => void;
  error?: boolean;
  triggerClassName?: string;
  /** Shows a button that clears the picked date, for optional dates. */
  clearable?: boolean;
};

/** Props for date-range mode. */
type RangeDatePickerProps = {
  onValueChange: (range: DateRange) => void;
  type: "range";
  value: DateRange;
  className?: string;
  label?: string;
  labelClassName?: string;
  placeholderFrom?: string;
  placeholderTo?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  onBlur?: () => void;
  error?: boolean;
  triggerClassName?: string;
  /** Shows a button that clears both dates. On by default: a range is almost always an optional filter. */
  clearable?: boolean;
};

type Props = SingleDatePickerProps | RangeDatePickerProps;

/**
 * Date picker component supporting single-date and date-range selection.
 * Renders a popover-based calendar triggered by a styled button.
 *
 * @example
 * ```tsx
 * // Single
 * <DatePicker type="single" value={date} onValueChange={setDate} label="Due date" />
 *
 * // Range
 * <DatePicker type="range" value={range} onValueChange={setRange} />
 * ```
 */
export function DatePicker(props: Props) {
  const t = useTranslations("Admin.datePicker");
  const {
    className,
    label,
    labelClassName,
    type,
    disabled = false,
    minDate,
    maxDate,
    disabledDates,
  } = props;
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean, onBlur?: () => void) => {
    setOpen(nextOpen);
    // Trigger blur validation when the popover closes
    if (!nextOpen && onBlur) onBlur();
  };

  if (type === "range") {
    const {
      value,
      onValueChange,
      placeholderFrom = t("startDate"),
      placeholderTo = t("endDate"),
      onBlur,
      error,
      triggerClassName,
      clearable = true,
    } = props as RangeDatePickerProps;
    const fromDisplay = value.from ? format(value.from, "MMM dd, yyyy") : "";
    const toDisplay = value.to ? format(value.to, "MMM dd, yyyy") : "";
    const showRangeClear = clearable && !disabled && !!(value.from || value.to);

    const handleRangeSelect = (range: DateRange) => {
      onValueChange(range);
      if (range.from && range.to) {
        setOpen(false);
        onBlur?.();
      }
    };

    const TRIGGER_CLASS = cn(
      "flex h-10 min-h-10 flex-1 items-center justify-between gap-x-2 rounded-md border border-input bg-background px-3 text-sm font-normal transition-colors",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:border-border focus:outline-none",
      disabled && "cursor-not-allowed opacity-50",
      error ? "border-destructive ring-1 ring-destructive" : "border-input",
      triggerClassName,
    );

    return (
      <div className={cn("flex flex-col gap-y-2", className)}>
        {label && (
          <label className={cn("text-sm font-medium text-neutral-700", labelClassName)}>
            {label}
          </label>
        )}
        <Popover open={open} onOpenChange={(o) => handleOpenChange(o, onBlur)}>
          <div className="relative">
            <PopoverTrigger
              render={
                <div className="flex items-center gap-x-2">
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(TRIGGER_CLASS, !fromDisplay && "text-muted-foreground")}
                  >
                    <span className="truncate">{fromDisplay || placeholderFrom}</span>
                    <CalendarIcon className="size-4 shrink-0 text-neutral-500" />
                  </button>
                  <span className="text-neutral-400">-</span>
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      TRIGGER_CLASS,
                      !toDisplay && "text-muted-foreground",
                      showRangeClear && "pr-16",
                    )}
                  >
                    <span className="truncate">{toDisplay || placeholderTo}</span>
                    <CalendarIcon className="size-4 shrink-0 text-neutral-500" />
                  </button>
                </div>
              }
            />
            {showRangeClear ? (
              <ClearDateButton
                label={t("clearDates")}
                onClear={() => {
                  onValueChange({ from: undefined, to: undefined });
                  onBlur?.();
                }}
              />
            ) : null}
          </div>
          <PopoverContent className="w-auto p-3" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              value={value}
              onSelect={handleRangeSelect}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  const {
    value,
    onValueChange,
    placeholder = t("selectDate"),
    onBlur,
    error,
    triggerClassName,
    clearable,
  } = props as SingleDatePickerProps;
  const displayValue = value ? format(value, "MMM dd, yyyy") : "";
  const showClear = clearable && !!value && !disabled;

  const handleSingleSelect = (date: Date | undefined) => {
    onValueChange(date);
    if (date) {
      setOpen(false);
      onBlur?.();
    }
  };

  return (
    <div className={cn("flex flex-col gap-y-2", className)}>
      {label && (
        <label className={cn("text-sm font-medium text-neutral-700", labelClassName)}>
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={(o) => handleOpenChange(o, onBlur)}>
        <div className="relative">
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "bg-background border-input flex h-10 min-h-10 w-full items-center justify-between gap-x-2 rounded-md border px-3 text-sm font-normal transition-colors",
                  "focus-visible:border-ring focus-visible:ring-ring/50 hover:border-border focus:outline-none focus-visible:ring-[3px]",
                  disabled && "cursor-not-allowed opacity-50",
                  !displayValue && "text-muted-foreground",
                  error ? "border-destructive ring-destructive ring-1" : "border-input",
                  showClear && "pr-16",
                  triggerClassName,
                )}
              >
                <span className="truncate">{displayValue || placeholder}</span>
                <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              </button>
            }
          />
          {showClear ? (
            <ClearDateButton
              label={t("clearDate")}
              onClear={() => {
                onValueChange(undefined);
                onBlur?.();
              }}
            />
          ) : null}
        </div>
        <PopoverContent className="w-auto p-3" align="start">
          <Calendar
            mode="single"
            value={value}
            onSelect={handleSingleSelect}
            minDate={minDate}
            maxDate={maxDate}
            disabledDates={disabledDates}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A sibling of the trigger, not inside it: a button can't hold another button. */
function ClearDateButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 absolute top-1/2 right-9 -translate-y-1/2 rounded-sm p-0.5 transition-colors focus:outline-none focus-visible:ring-[3px]"
      onClick={onClear}
    >
      <X className="size-4" />
    </button>
  );
}
