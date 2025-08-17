
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { scheduleEvent, ScheduleEventInput } from '@/ai/flows/schedule-event';
import { useToast } from '@/hooks/use-toast';
import { Note } from '@/hooks/use-auth';
import { DateTimePickerDialog } from '@/components/datetime-picker-dialog';

export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
  const params = useParams();
  const noteId = params.noteId as string;
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      redirect('/auth');
      return;
    }
    if (!noteId) {
      setLoading(false);
      return;
    }

    const noteRef = doc(db, 'users', user.uid, 'notes', noteId);
    const unsubscribe = onSnapshot(noteRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNote({ 
          id: docSnap.id,
          ...data
        } as Note);
      } else {
        notFound();
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching note:', error);
      setNote(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, noteId]);

  const handleDateTimeSubmit = async (selectedDate: Date | undefined) => {
    if (!note || !user || !selectedDate) {
      setIsDateTimePickerOpen(false);
      return;
    };
    setIsDateTimePickerOpen(false);
    setIsSyncing(true);

    const newDueDate = selectedDate.toISOString();

    try {
      const scheduleEventInput: ScheduleEventInput = {
        userId: user.uid,
        title: note.title,
        startTime: newDueDate,
      };

      if (note.calendarEventId) {
        scheduleEventInput.eventId = note.calendarEventId;
      }
      
      const eventId = await scheduleEvent(scheduleEventInput);

      const noteRef = doc(db, 'users', user.uid, 'notes', note.id);
      await updateDoc(noteRef, { calendarEventId: eventId, dueDate: newDueDate });

      toast({
          title: 'Success!',
          description: 'The task has been synced with your Google Calendar.'
      });
    } catch (error: any) {
        toast({
            title: 'Failed to sync to calendar',
            description: error.message || 'An unknown error occurred.',
            variant: 'destructive'
        });
    } finally {
        setIsSyncing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
         <h2 className="text-xl font-semibold">Error Loading Note</h2>
         <p className="mt-2 text-muted-foreground">
            Could not load the note. This might be because of a network issue, <br />
            or you may not have permission to view it.
         </p>
      </div>
    )
  }

  return (
    <>
      <NoteEditor note={note} onSyncToCalendar={() => setIsDateTimePickerOpen(true)} isSyncing={isSyncing} />
      <DateTimePickerDialog 
        isOpen={isDateTimePickerOpen}
        onOpenChange={setIsDateTimePickerOpen}
        initialDate={note.dueDate ? new Date(note.dueDate) : new Date()}
        onSubmit={handleDateTimeSubmit}
      />
    </>
  );
}
