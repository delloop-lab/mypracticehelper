import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a date value that may be a string, number, null, or undefined.
 * Returns a valid Date object or null if parsing fails.
 * Works consistently on both desktop and mobile browsers.
 */
export function safeParseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    
    // Try parsing as-is first (works for ISO strings)
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try parsing as timestamp number
    const timestamp = Number(trimmed);
    if (!isNaN(timestamp)) {
      date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return null;
  }
  
  return null;
}

/**
 * Safely format a date for display. Returns fallback string if date is invalid.
 * Works consistently on both desktop and mobile browsers.
 */
export function safeFormatDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'en-US',
  fallback: string = 'No date'
): string {
  const date = safeParseDate(value);
  if (!date) {
    return fallback;
  }
  
  try {
    return date.toLocaleString(locale, options);
  } catch {
    return fallback;
  }
}
