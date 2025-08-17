
'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { Note } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    gapi: any;
  }
}

export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const params = useParams();
  const noteId = params.noteId as string;
  const { toast } = useToast();

  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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

  const initClientAndCreateEvent = useCallback(async (date: Date) => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
        toast({ title: 'Configuration Error', description: 'Google API Key is not configured. Please set NEXT_PUBLIC_GOOGLE_API_KEY in your environment.', variant: 'destructive' });
        return;
    }
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
        toast({ title: 'Configuration Error', description: 'Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.', variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    try {
        await new Promise<void>((resolve, reject) => {
            window.gapi.load('client:auth2', async () => {
                try {
                    await window.gapi.client.init({
                        apiKey: GOOGLE_API_KEY,
                        clientId: GOOGLE_CLIENT_ID,
                        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
                        scope: "https://www.googleapis.com/auth/calendar.events"
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });

        if (!window.gapi.auth2.getAuthInstance().isSignedIn.get()) {
            await window.gapi.auth2.getAuthInstance().signIn();
        }

        const event = {
            'summary': note?.title || 'Untitled Task',
            'description': `Task details and subtasks. Progress: ${note?.progress}%`,
            'start': {
                'dateTime': date.toISOString(),
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            'end': {
                'dateTime': new Date(date.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            'reminders': {
                'useDefault': false,
                'overrides': [
                    { 'method': 'email', 'minutes': 24 * 60 },
                    { 'method': 'popup', 'minutes': 10 }
                ]
            },
            'conferenceData': {
                'createRequest': {
                  'requestId': uuidv4(),
                  'conferenceSolutionKey': {
                    'type': 'hangoutsMeet'
                  }
                }
              },
        };

        let request;
        if (note?.calendarEventId) {
            request = window.gapi.client.calendar.events.update({
                'calendarId': 'primary',
                'eventId': note.calendarEventId,
                'resource': event
            });
        } else {
            request = window.gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event,
                'conferenceDataVersion': 1
            });
        }

        const response = await request;
        const calendarEventId = response.result.id;
        
        const noteRef = getNoteRef();
        if (noteRef) {
            await updateDoc(noteRef, { calendarEventId });
            setNote(prev => prev ? { ...prev, calendarEventId } : null);
        }

        toast({ title: 'Synced with Google Calendar!', description: `Event "${event.summary}" has been created/updated.` });
        
    } catch (error: any) {
        console.error('Full Google Calendar API Error:', JSON.stringify(error, null, 2));
        let friendlyMessage = "An unexpected error occurred while syncing with Google Calendar.";
        if (typeof error === 'string') {
            try {
                const parsedError = JSON.parse(error);
                if (parsedError.details) friendlyMessage = `Google Calendar Error: ${parsedError.details}`;
            } catch (e) {
                friendlyMessage = `An unexpected error occurred: ${error}`;
            }
        } else if (error.result?.error?.message) {
            friendlyMessage = `Google Calendar Error: ${error.result.error.message}`;
        } else if (error.message) {
            friendlyMessage = error.message;
        } else if (error.details && error.details.includes('Not a valid origin')) {
            friendlyMessage = `CONFIGURATION ERROR: Your application's URL (${window.location.origin}) is not authorized. Please go to the Google Cloud Console and add this exact URL to the 'Authorized JavaScript origins' for your OAuth Client ID.`;
        }


        toast({
            title: 'Sync Error',
            description: friendlyMessage,
            variant: 'destructive',
            duration: 15000,
        });
    } finally {
        setIsSyncing(false);
    }
  }, [note, getNoteRef, toast, GOOGLE_API_KEY, GOOGLE_CLIENT_ID]);

  const handleDateTimeSubmit = async (date?: Date) => {
    if (!date) return;

    const noteRef = getNoteRef();
    if (!noteRef) return;

    const dueDate = date.toISOString();
    setNote(prev => prev ? { ...prev, dueDate } : null);
    await updateDoc(noteRef, { dueDate });

    await initClientAndCreateEvent(date);
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
    <NoteEditor 
        note={note} 
        onDateTimeSubmit={handleDateTimeSubmit}
        isSyncing={isSyncing}
    />
  );
}

    