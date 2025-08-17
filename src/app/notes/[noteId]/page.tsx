
'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound, useParams } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';
import { Note } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { syncToNotion } from '@/ai/flows/sync-to-notion';


export default function NotePage() {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const params = useParams();
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

  const handleNotionSync = async () => {
    if (!note) return;

    setIsSyncing(true);
    try {
      const result = await syncToNotion({
        title: note.title,
        subtasks: note.subtasks.map(st => ({ text: st.text, completed: st.completed }))
      });

      if (result.success) {
        toast({
          title: 'Synced to Notion!',
          description: `Page created successfully.`,
        });
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      console.error('Notion Sync Error:', error);
      toast({
        title: 'Notion Sync Error',
        description: error.message,
        variant: 'destructive',
        duration: 10000,
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
    <NoteEditor 
        note={note} 
        onNotionSync={handleNotionSync}
        isSyncing={isSyncing}
    />
  );
}
