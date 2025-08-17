
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from './ui/input';

interface DateTimePickerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialDate?: Date;
  onSubmit: (date?: Date) => void;
}

export function DateTimePickerDialog({
  isOpen,
  onOpenChange,
  initialDate = new Date(),
  onSubmit,
}: DateTimePickerDialogProps) {
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState<string>(format(initialDate, 'HH:mm'));

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
  }

  const handleSubmit = () => {
    if (!date) {
      onSubmit(undefined);
      return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    onSubmit(newDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Task</DialogTitle>
          <DialogDescription>
            Select a date and time to sync this task with your calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Input 
            type="time"
            value={time}
            onChange={handleTimeChange}
          />
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={!date}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
