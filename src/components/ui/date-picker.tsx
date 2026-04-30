"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  minDate,
}: DatePickerProps) {
  const parseDateValue = React.useCallback((dateValue: string): Date | undefined => {
    if (!dateValue) return undefined;
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, []);

  const parsedDate =
    typeof value === "string"
      ? value
        ? parseDateValue(value)
        : undefined
      : value;

  const normalizedMinDate = React.useMemo(() => {
    if (!minDate) return undefined;
    const normalized = new Date(minDate);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }, [minDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !parsedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {parsedDate ? format(parsedDate, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(date) => onChange?.(date)}
          initialFocus
          fromDate={normalizedMinDate}
          toDate={undefined}
          disabled={(date) => {
            if (normalizedMinDate) {
              const checkDate = new Date(date);
              checkDate.setHours(0, 0, 0, 0);
              if (checkDate < normalizedMinDate) {
                return true;
              }
            }
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

