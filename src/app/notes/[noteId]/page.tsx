
'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Note } from '@/hooks/use-auth';
import { DateTimePickerDialog } from '@/components/datetime-picker-dialog';
import { GoogleAuthProvider, reauthenticateWithPopup, getAuth } from 'firebase/auth';

declare const gapi: any;
declare const google: any;

export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
  const params = useParams();
  const noteId = params.noteId as string;
  const { toast } = useToast();

  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

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
  
  const initClientAndCreateEvent = useCallback(async (token: string, newDueDate: string) => {
    if (!note || !user) return;
    
    try {
        await new Promise<void>((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: GOOGLE_API_KEY,
                        clientId: GOOGLE_CLIENT_ID,
                        discoveryDocs: [DISCOVERY_DOC],
                        scope: SCOPES,
                    });
                     // Set the token for the API client
                    gapi.client.setToken({ access_token: token });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });

        const eventEndTime = new Date(new Date(newDueDate).getTime() + 60 * 60 * 1000).toISOString();

        const event = {
          summary: note.title,
          start: {
            dateTime: newDueDate,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: eventEndTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };

        const request = note.calendarEventId
            ? gapi.client.calendar.events.update({
                calendarId: 'primary',
                eventId: note.calendarEventId,
                resource: event,
              })
            : gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
              });

        const response = await request;
        const eventId = response.result.id;

        const noteRef = doc(db, 'users', user.uid, 'notes', note.id);
        await updateDoc(noteRef, { calendarEventId: eventId, dueDate: newDueDate });

        toast({
            title: 'Success!',
            description: 'The task has been synced with your Google Calendar.'
        });

    } catch (error: any) {
        console.error('Full Google Calendar API Error:', error);
        let friendlyMessage = "An unexpected error occurred while syncing with Google Calendar.";
        if (error.result?.error?.message) {
            friendlyMessage = `Google Calendar Error: ${error.result.error.message}`;
        } else if (error.message) {
            friendlyMessage = error.message;
        }
        toast({
            title: 'Failed to sync to calendar',
            description: friendlyMessage,
            variant: 'destructive'
        });
    } finally {
        setIsSyncing(false);
    }
  }, [note, user, toast, GOOGLE_API_KEY, GOOGLE_CLIENT_ID]);


  const handleDateTimeSubmit = async (selectedDate: Date | undefined) => {
    if (!note || !user || !selectedDate) {
      setIsDateTimePickerOpen(false);
      return;
    };
    setIsDateTimePickerOpen(false);
    setIsSyncing(true);

    try {
      const newDueDate = selectedDate.toISOString();
      const credential = GoogleAuthProvider.credential(await user.getIdToken());
      const auth = getAuth();
      
      const result = await reauthenticateWithPopup(auth.currentUser!, new GoogleAuthProvider());
      const freshCredential = GoogleAuthProvider.credentialFromResult(result);
      if (!freshCredential || !freshCredential.accessToken) {
          throw new Error("Could not get a fresh access token from Google.");
      }
      
      await initClientAndCreateEvent(freshCredential.accessToken, newDueDate);

    } catch (error: any) {
        let friendlyMessage = error.message;
        if (error.code === 'auth/popup-closed-by-user') {
            friendlyMessage = 'The Google authentication popup was closed before completing.';
        }
        toast({
            title: 'Authentication Failed',
            description: friendlyMessage,
            variant: 'destructive'
        });
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
