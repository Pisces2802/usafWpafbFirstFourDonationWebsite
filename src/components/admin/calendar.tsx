"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { cn } from "cn";
import {
  addMonths,
  endOfDay,
  endOfMonth,
  format,
  subMonths,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  isWithinInterval,
} from "date-fns";

/** A date range with optional start and end dates. */
export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

/**
 * Props for the Calendar component.
 * Supports both single-date and date-range selection modes.
 */
type CalendarProps = {
  className?: string;
  disabledDates?: Date[];
  maxDate?: Date;
  minDate?: Date;
  numberOfMonths?: number;
} & (
  | {
      mode?: "single";
      onSelect: (date: Date | undefined) => void;
      value: Date | undefined;
    }
  | {
      mode: "range";
      onSelect: (range: DateRange) => void;
      value: DateRange;
    }
);

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/**
 * Headless calendar component supporting single and range date selection.
 * Renders one or more month grids with navigation, disabled dates, and min/max constraints.
 * Click the year in the header to open a year grid for fast year navigation.
 *
 * @example
 * ```tsx
 * // Single mode
 * <Calendar mode="single" value={date} onSelect={setDate} />
 *
 * // Range mode
 * <Calendar mode="range" numberOfMonths={2} value={range} onSelect={setRange} />
 * ```
 */
export function Calendar(props: CalendarProps) {
  const t = useTranslations("Admin.datePicker");
  const { className, disabledDates, maxDate, minDate, mode = "single", numberOfMonths = 1 } = props;

  const dayLabels = [
    t("sunday"),
    t("monday"),
    t("tuesday"),
    t("wednesday"),
    t("thursday"),
    t("friday"),
    t("saturday"),
  ];

  // The date the calendar should focus on: the selected value (single mode) or the
  // range start (range mode). Used to open the grid on the selected month rather
  // than today's, and to re-sync when the value changes (e.g. the popover reopens).
  const focusedDate =
    mode === "single"
      ? (props as { value: Date | undefined }).value
      : (props as { value: DateRange }).value?.from;

  const outsideBounds = (month: Date) =>
    (!!minDate && isBefore(endOfMonth(month), startOfDay(minDate))) ||
    (!!maxDate && isAfter(startOfMonth(month), endOfDay(maxDate)));

  // Open on the picked date while its month is selectable; otherwise on today kept inside the range: from minDate
  // when today is before it, and on maxDate when today is past it (a date of birth). Several months open early
  // enough that the last one shown is still maxDate's, as picking a year does, so the grid never opens on a month
  // that's all disabled.
  const openingDate = () => {
    const today = new Date();
    let month =
      focusedDate && !outsideBounds(focusedDate)
        ? focusedDate
        : minDate && isBefore(today, startOfDay(minDate))
          ? minDate
          : maxDate && isAfter(today, endOfDay(maxDate))
            ? maxDate
            : today;
    const lastMonth = maxDate ? subMonths(startOfMonth(maxDate), numberOfMonths - 1) : undefined;
    if (lastMonth && isAfter(month, lastMonth)) month = lastMonth;
    if (minDate && isBefore(month, startOfMonth(minDate))) month = startOfMonth(minDate);
    // Always the 1st: the month-step bounds compare against the 1st of maxDate's month, so a mid-month value would
    // stop one month short (opening on 3 Nov could never reach December).
    return startOfMonth(month);
  };
  const [view, setView] = React.useState<"days" | "years">("days");

  // The month shown is derived, not synced: manual navigation is kept only while it still applies. It's dropped
  // when the focused value moves to another month (the grid follows the value, e.g. when the popover reopens), and
  // when the bounds change so the month shown is wholly outside them (a dependent field moving them), picked date
  // or not, rather than leaving a grid of disabled days.
  const focusedMonth = focusedDate ? startOfMonth(focusedDate).getTime() : null;
  const [navigation, setNavigation] = React.useState<{
    focus: number | null;
    month: Date;
    yearStart: number;
  }>();
  const navigated =
    navigation && navigation.focus === focusedMonth && !outsideBounds(navigation.month)
      ? navigation
      : undefined;
  const currentMonth = navigated?.month ?? openingDate();
  const yearRangeStart = navigated?.yearStart ?? currentMonth.getFullYear() - 5;
  const setCurrentMonth = (month: Date) =>
    setNavigation({ focus: focusedMonth, month: startOfMonth(month), yearStart: yearRangeStart });
  const setYearRangeStart = (yearStart: number) =>
    setNavigation({ focus: focusedMonth, month: currentMonth, yearStart });

  const isDateDisabled = React.useCallback(
    (date?: Date): boolean => {
      if (!date) return false;
      // Whole days, both ends: a minDate of `new Date()` still allows today, and a maxDate of today stays open
      // until the day ends.
      if (minDate && isBefore(date, startOfDay(minDate))) return true;
      if (maxDate && isAfter(date, endOfDay(maxDate))) return true;
      if (disabledDates?.some((disabledDate) => isSameDay(date, disabledDate))) return true;
      return false;
    },
    [minDate, maxDate, disabledDates],
  );

  const isSelected = React.useCallback(
    (day?: Date): boolean => {
      if (!day) return false;
      if (mode === "single") {
        const { value } = props as { value: Date | undefined };
        return !!value && isSameDay(day, value);
      }
      const { value } = props as { value: DateRange };
      return (
        (!!value.from && isSameDay(day, value.from)) || (!!value.to && isSameDay(day, value.to))
      );
    },
    [mode, props],
  );

  const isInRange = React.useCallback(
    (day?: Date): boolean => {
      if (!day || mode !== "range") return false;
      const { value } = props as { value: DateRange };
      if (!value.from || !value.to) return false;
      return isWithinInterval(day, { start: value.from, end: value.to });
    },
    [mode, props],
  );

  const isRangeStart = React.useCallback(
    (day?: Date): boolean => {
      if (!day || mode !== "range") return false;
      const { value } = props as { value: DateRange };
      return !!value.from && isSameDay(day, value.from);
    },
    [mode, props],
  );

  const isRangeEnd = React.useCallback(
    (day?: Date): boolean => {
      if (!day || mode !== "range") return false;
      const { value } = props as { value: DateRange };
      return !!value.to && isSameDay(day, value.to);
    },
    [mode, props],
  );

  const handlePreviousMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    if (minDate && isBefore(prevMonth, startOfMonth(minDate))) return;
    setCurrentMonth(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    if (maxDate && isAfter(addMonths(nextMonth, numberOfMonths - 1), startOfMonth(maxDate))) return;
    setCurrentMonth(nextMonth);
  };

  const getCalendarDays = React.useCallback((monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const days: (Date | undefined)[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(undefined);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, []);

  const months = React.useMemo(() => {
    return Array.from({ length: numberOfMonths }, (_, i) => addMonths(currentMonth, i));
  }, [currentMonth, numberOfMonths]);

  const isPrevDisabled = React.useMemo(() => {
    return minDate ? isBefore(subMonths(currentMonth, 1), startOfMonth(minDate)) : false;
  }, [currentMonth, minDate]);

  const isNextDisabled = React.useMemo(() => {
    const lastMonth = addMonths(currentMonth, numberOfMonths - 1);
    return maxDate ? isAfter(addMonths(lastMonth, 1), startOfMonth(maxDate)) : false;
  }, [currentMonth, maxDate, numberOfMonths]);

  const handleDayClick = React.useCallback(
    (day: Date | undefined) => {
      if (!day) return;

      if (mode === "single") {
        const { onSelect } = props as { onSelect: (date: Date | undefined) => void };
        onSelect(day);
      } else {
        const { onSelect, value } = props as {
          onSelect: (range: DateRange) => void;
          value: DateRange;
        };

        if (!value.from || (value.from && value.to)) {
          onSelect({ from: day, to: undefined });
        } else if (isBefore(day, value.from)) {
          onSelect({ from: day, to: value.from });
        } else {
          onSelect({ from: value.from, to: day });
        }
      }
    },
    [mode, props],
  );

  // -------------------------------------------------------------------------
  // Year picker helpers
  // -------------------------------------------------------------------------

  const years = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearRangeStart + i),
    [yearRangeStart],
  );

  const isPrevYearRangeDisabled = minDate ? yearRangeStart <= minDate.getFullYear() : false;
  const isNextYearRangeDisabled = maxDate ? yearRangeStart + 11 >= maxDate.getFullYear() : false;

  const openYearView = () => {
    // Centre the visible range on the currently displayed year.
    setYearRangeStart(currentMonth.getFullYear() - 5);
    setView("years");
  };

  // The same month in the chosen year, pulled inside the bounds when the year only partly falls within them (with
  // minDate in December, picking that year from January lands on December), so it never lands on a disabled month.
  const handleYearSelect = (year: number) => {
    let month = new Date(year, currentMonth.getMonth(), 1);
    const lastMonth = maxDate ? subMonths(startOfMonth(maxDate), numberOfMonths - 1) : undefined;
    if (lastMonth && isAfter(month, lastMonth)) month = lastMonth;
    if (minDate && isBefore(month, startOfMonth(minDate))) month = startOfMonth(minDate);
    setCurrentMonth(month);
    setView("days");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={cn("flex gap-x-4", className)}>
      {view === "years" ? (
        // ----- Year picker grid -----
        <div className="w-64 shrink-0 space-y-3">
          <div className="flex w-full items-center justify-between gap-x-4">
            <button
              type="button"
              aria-label={t("previousYears")}
              disabled={isPrevYearRangeDisabled}
              className={cn(
                "grid size-7 place-items-center rounded border border-neutral-400 transition-opacity",
                isPrevYearRangeDisabled && "cursor-not-allowed opacity-50",
              )}
              onClick={() => setYearRangeStart(yearRangeStart - 12)}
            >
              <ChevronLeftIcon className="size-4" />
            </button>

            <span className="flex-1 text-center text-sm font-medium">
              {yearRangeStart} – {yearRangeStart + 11}
            </span>

            <button
              type="button"
              aria-label={t("nextYears")}
              disabled={isNextYearRangeDisabled}
              className={cn(
                "grid size-7 place-items-center rounded border border-neutral-400 transition-opacity",
                isNextYearRangeDisabled && "cursor-not-allowed opacity-50",
              )}
              onClick={() => setYearRangeStart(yearRangeStart + 12)}
            >
              <ChevronLeftIcon className="size-4 rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {years.map((year) => {
              const isCurrent = year === currentMonth.getFullYear();
              const isDisabled =
                (!!minDate && year < minDate.getFullYear()) ||
                (!!maxDate && year > maxDate.getFullYear());
              return (
                <button
                  key={year}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleYearSelect(year)}
                  className={cn(
                    "rounded px-1 py-2 text-sm transition-colors",
                    isCurrent && "bg-primary-500 text-white",
                    !isCurrent && !isDisabled && "hover:bg-neutral-200",
                    isDisabled && "cursor-not-allowed text-neutral-300",
                  )}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        // ----- Day picker (existing) -----
        <>
          {months.map((monthDate, monthIndex) => {
            const calendarDays = getCalendarDays(monthDate);
            const isFirstMonth = monthIndex === 0;
            const isLastMonth = monthIndex === numberOfMonths - 1;

            return (
              <div key={monthDate.toISOString()} className="w-64 shrink-0 space-y-2">
                <div className="flex w-full items-center justify-between gap-x-4">
                  {isFirstMonth ? (
                    <button
                      className={cn(
                        "grid size-7 place-items-center rounded border border-neutral-400 transition-opacity",
                        isPrevDisabled && "cursor-not-allowed opacity-50",
                      )}
                      onClick={handlePreviousMonth}
                      disabled={isPrevDisabled}
                      type="button"
                      aria-label={t("previousMonth")}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                  ) : (
                    <div className="size-7" />
                  )}

                  <div className="flex-1 text-center text-sm font-medium">
                    {format(monthDate, "MMMM,")}{" "}
                    <button
                      type="button"
                      onClick={openYearView}
                      className="underline-offset-2 hover:underline"
                      aria-label={t("pickYear")}
                    >
                      {format(monthDate, "yyyy")}
                    </button>
                  </div>

                  {isLastMonth ? (
                    <button
                      className={cn(
                        "grid size-7 place-items-center rounded border border-neutral-400 transition-opacity",
                        isNextDisabled && "cursor-not-allowed opacity-50",
                      )}
                      onClick={handleNextMonth}
                      disabled={isNextDisabled}
                      type="button"
                      aria-label={t("nextMonth")}
                    >
                      <ChevronLeftIcon className="size-4 rotate-180" />
                    </button>
                  ) : (
                    <div className="size-7" />
                  )}
                </div>

                <div className="grid w-full grid-cols-7 gap-x-1">
                  {DAYS_OF_WEEK.map((day, i) => (
                    <div
                      key={day}
                      className="flex aspect-square items-center justify-center text-sm font-medium text-neutral-500"
                    >
                      {dayLabels[i]}
                    </div>
                  ))}
                </div>

                <div className="grid w-full grid-cols-7 gap-y-1">
                  {calendarDays.map((day, index) => {
                    const disabled = isDateDisabled(day);
                    const selected = isSelected(day);
                    const inRange = isInRange(day);
                    const rangeStart = isRangeStart(day);
                    const rangeEnd = isRangeEnd(day);

                    return (
                      <div
                        key={`${monthDate.getMonth()}-${index}`}
                        className={cn(
                          "relative",
                          inRange && !rangeStart && !rangeEnd && "bg-primary-100",
                          rangeStart &&
                            "to-primary-100 rounded-l-lg bg-linear-to-r from-transparent",
                          rangeEnd && "to-primary-100 rounded-r-lg bg-linear-to-l from-transparent",
                          rangeStart && rangeEnd && "bg-transparent",
                        )}
                      >
                        <button
                          className={cn(
                            "relative z-10 aspect-square w-full rounded text-sm transition-colors",
                            day && !disabled && !selected && "hover:bg-neutral-300",
                            selected && "bg-primary-500 text-white",
                            inRange && !selected && "text-primary-700",
                            disabled && "cursor-not-allowed text-neutral-300 hover:bg-transparent",
                          )}
                          disabled={!day || disabled}
                          onClick={() => handleDayClick(day)}
                          type="button"
                          aria-label={day ? format(day, "EEEE, MMMM do, yyyy") : undefined}
                        >
                          {day && format(day, "d")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
