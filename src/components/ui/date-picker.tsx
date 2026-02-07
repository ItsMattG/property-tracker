"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parse } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** YYYY-MM-DD string or empty string */
  value?: string
  /** Called with YYYY-MM-DD string */
  onChange?: (date: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return isNaN(parsed.getTime()) ? undefined : parsed
}

function fromDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange?.(fromDate(date))
            }
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
export type { DatePickerProps }
