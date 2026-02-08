"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
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

function toDisplayString(value: string | undefined): string {
  if (!value) return ""
  const date = toDate(value)
  if (!date) return ""
  return format(date, "dd/MM/yyyy")
}

const thirtyYearsAgo = new Date(new Date().getFullYear() - 30, 0, 1)

function DatePicker({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  disabled,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputText, setInputText] = React.useState(() => toDisplayString(value))
  const selected = toDate(value)

  // Sync inputText when value changes externally (e.g. calendar pick)
  const prevValueRef = React.useRef(value)
  React.useEffect(() => {
    if (value !== prevValueRef.current) {
      setInputText(toDisplayString(value))
      prevValueRef.current = value
    }
  }, [value])

  const commitInput = () => {
    if (!inputText.trim()) {
      return
    }
    const parsed = parse(inputText, "dd/MM/yyyy", new Date())
    if (isValid(parsed) && inputText.length === 10) {
      const isoStr = fromDate(parsed)
      onChange?.(isoStr)
      prevValueRef.current = isoStr
    } else {
      // Revert to last valid value
      setInputText(toDisplayString(value))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative flex items-center", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "absolute left-0 h-full px-2.5 text-muted-foreground hover:text-foreground transition-colors z-10",
              disabled && "pointer-events-none opacity-50",
            )}
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <Input
          id={id}
          disabled={disabled}
          placeholder={placeholder}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitInput()
            }
          }}
          className="pl-9"
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          startMonth={thirtyYearsAgo}
          endMonth={new Date()}
          onSelect={(date) => {
            if (date) {
              const isoStr = fromDate(date)
              onChange?.(isoStr)
              setInputText(format(date, "dd/MM/yyyy"))
              prevValueRef.current = isoStr
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
