"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange, DayPicker } from "react-day-picker";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
    date: DateRange | undefined;
    onDateChange: (date: DateRange | undefined) => void;
    className?: string;
}

export function DateRangePicker({ date, onDateChange, className }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date);

    React.useEffect(() => {
        if (isOpen) {
            setTempDate(date);
        }
    }, [isOpen, date]);

    const handleApply = () => {
        onDateChange(tempDate);
        setIsOpen(false);
    };

    const handleCancel = () => {
        setTempDate(date);
        setIsOpen(false);
    };

    const presets = [
        { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
        { label: "Yesterday", getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
        { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
        { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
        { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
        { label: "Last month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
        { label: "This year", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
    ];

    return (
        <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    className={`flex h-9 items-center justify-start gap-2 rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors hover:bg-foreground/5 focus:outline-none focus:ring-1 focus:ring-primary ${!date ? "text-muted-foreground" : "text-foreground"} ${className || ""}`}
                >
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                    <span>
                        {date?.from ? (
                            date.to ? (
                                <>{format(date.from, "LLL dd, yyyy")} - {format(date.to, "LLL dd, yyyy")}</>
                            ) : (
                                format(date.from, "LLL dd, yyyy")
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                    </span>
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={4}
                    className="z-[9999] w-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                >
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                        {/* Left Sidebar Presets */}
                        <div className="flex flex-col w-full md:w-[150px] p-2 gap-1 bg-foreground/[0.02]">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => setTempDate(preset.getValue())}
                                    className="flex w-full items-center justify-start rounded-md px-3 py-2 text-sm text-left font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Calendar Area */}
                        <div className="p-3 bg-card dark:[--rdp-background-color:rgba(255,255,255,0.05)] dark:[--rdp-accent-color:var(--color-primary)] dark:[--rdp-outline:2px_solid_var(--color-primary)]">
                            <DayPicker
                                mode="range"
                                selected={tempDate}
                                onSelect={setTempDate}
                                numberOfMonths={2}
                                showOutsideDays
                                className="rdp-custom"
                            />
                        </div>
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-border p-3 bg-foreground/[0.02]">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-foreground/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
