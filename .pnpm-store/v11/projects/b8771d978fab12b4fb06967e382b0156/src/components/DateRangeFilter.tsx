import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatShortDate } from "@/lib/forecast";
import type { DateRange } from "@/types/forecast";

export function DatePicker({
  id,
  label,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={invalid ? "decision-error" : undefined}
            className="h-10 w-full justify-between bg-white px-3 text-sm font-normal shadow-none"
          >
            <span className="flex items-center gap-2">
              <CalendarDays size={15} className="text-muted-foreground" />
              {value ? formatShortDate(value) : "Pick a date"}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={{
              before: new Date(2026, 0, 1),
              after: new Date(2026, 0, 31),
            }}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
export function DateRangeFilter({
  range,
  disabled,
  invalid,
  onChange,
}: {
  range: DateRange;
  disabled: boolean;
  invalid: boolean;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row">
      <DatePicker
        id="start-date"
        label="Start decision date"
        value={range.start}
        disabled={disabled}
        invalid={invalid}
        onChange={(start) => onChange({ ...range, start })}
      />
      <DatePicker
        id="end-date"
        label="End decision date"
        value={range.end}
        disabled={disabled}
        invalid={invalid}
        onChange={(end) => onChange({ ...range, end })}
      />
    </div>
  );
}
