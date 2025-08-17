
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { scheduleEvent } from '@/ai/flows/schedule-event';
import { useToast } from '@/hooks/use-toast';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  formatted_content: string | null;
  created_at: Timestamp;
  subtasks: Subtask[];
  progress: number;
  status: 'pending' | 'inprogress' | 'finished';
  dueDate?: string;
  calendarEventId?: string;
};

export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
          title: data.title,
          content: data.content,
          formatted_content: data.formatted_content,
          created_at: data.created_at,
          subtasks: data.subtasks || [],
          progress: data.progress || 0,
          status: data.status || 'pending',
          dueDate: data.dueDate,
          calendarEventId: data.calendarEventId,
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

  const handleSyncToCalendar = async () => {
    if (!note || !user) return;
    setIsSyncing(true);

    try {
      const { dueDate } = await new Promise<any>((resolve, reject) => {
        const newDueDate = prompt("When is this task due?", note.dueDate || new Date().toISOString());
        if (newDueDate) {
            resolve({ dueDate: new Date(newDueDate).toISOString() });
        } else {
            reject("Invalid date");
        }
      });
      
      const eventId = await scheduleEvent({
          userId: user.uid,
          title: note.title,
          startTime: dueDate,
          eventId: note.calendarEventId
      });

      const noteRef = doc(db, 'users', user.uid, 'notes', note.id);
      await updateDoc(noteRef, { calendarEventId: eventId, dueDate: dueDate });

      toast({
          title: 'Successfully synced to calendar!',
          description: 'The task has been added or updated in your Google Calendar.'
      });
    } catch (error: any) {
        toast({
            title: 'Failed to sync to calendar',
            description: error.message || 'There was an issue creating the calendar event.',
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
         <p className="mt-2 text-sm text-muted-foreground">
            Please check your Firestore security rules in the Firebase Console.
         </p>
      </div>
    )
  }

  return <NoteEditor note={note} onSyncToCalendar={handleSyncToCalendar} isSyncing={isSyncing} />;
}
