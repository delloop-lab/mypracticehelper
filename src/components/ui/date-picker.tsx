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
  blockedDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  minDate,
  blockedDays = [],
}: DatePickerProps) {
  const parsedDate =
    typeof value === "string"
      ? value
        ? new Date(value)
        : undefined
      : value;

  // Ensure blockedDays is always an array
  const safeBlockedDays = React.useMemo(() => {
    if (!blockedDays) return [];
    if (!Array.isArray(blockedDays)) return [];
    return blockedDays;
  }, [blockedDays]);

  // Helper function to check if a date is disabled
  const isDateDisabled = React.useCallback((date: Date): boolean => {
    // Disable past dates if minDate is set
    if (minDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < today) return true;
    }
    // Disable blocked days of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
    if (safeBlockedDays.length > 0) {
      const dayOfWeek = date.getDay();
      if (safeBlockedDays.includes(dayOfWeek)) {
        return true;
      }
    }
    return false;
  }, [minDate, safeBlockedDays]);

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
          onSelect={(date) => {
            // Allow selection of blocked days (warning will be shown in the form)
            onChange?.(date);
          }}
          initialFocus
          fromDate={minDate || undefined}
          toDate={undefined}
          disabled={(date) => {
            // Disable past dates if minDate is set
            if (minDate) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const checkDate = new Date(date);
              checkDate.setHours(0, 0, 0, 0);
              if (checkDate < today) return true;
            }
            // Allow blocked days to be selected (they will show a warning instead)
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

