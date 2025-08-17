
'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams, useRouter } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { Note } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { DateTimePickerDialog } from '@/components/datetime-picker-dialog';


export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);

  const params = useParams();
  const router = useRouter();
  const noteId = params.noteId as string;
  const { toast } = useToast();

  const getNoteRef = useCallback(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'notes', noteId);
  }, [user, noteId]);

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

    const noteRef = getNoteRef();
    if (!noteRef) return;

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
  }, [user, authLoading, noteId, getNoteRef]);

  const handleSchedule = () => {
    setIsDateTimePickerOpen(true);
  }

  const handleDateTimeSubmit = async (date?: Date) => {
    setIsDateTimePickerOpen(false);
    if (!date || !note) return;

    const noteRef = getNoteRef();
    if (!noteRef) return;

    try {
        await updateDoc(noteRef, {
            dueDate: date.toISOString(),
        });
        toast({
            title: 'Task Scheduled',
            description: `Reminder set for ${date.toLocaleString()}.`,
        });
    } catch (error: any) {
        toast({
            title: 'Error Scheduling Task',
            description: error.message,
            variant: 'destructive',
        });
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
        <NoteEditor 
            note={note} 
            onSchedule={handleSchedule}
        />
        <DateTimePickerDialog 
            isOpen={isDateTimePickerOpen}
            onOpenChange={setIsDateTimePickerOpen}
            initialDate={note.dueDate ? new Date(note.dueDate) : new Date()}
            onSubmit={handleDateTimeSubmit}
        />
    </>
  );
}
