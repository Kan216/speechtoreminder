'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { redirect, notFound } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { Loader2 } from 'lucide-react';

type Note = {
  id: string;
  title: string;
  content: string;
  formatted_content: string | null;
  created_at: Timestamp;
};

export default function NotePage({ params }: { params: { noteId: string } }) {
  const { user, loading: authLoading } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      redirect('/auth');
      return;
    }

    const fetchNote = async () => {
      try {
        const noteRef = doc(db, 'users', user.uid, 'notes', params.noteId);
        const noteSnap = await getDoc(noteRef);

        if (noteSnap.exists()) {
          setNote({ id: noteSnap.id, ...noteSnap.data() } as Note);
        } else {
          notFound();
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        notFound();
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [user, authLoading, params.noteId]);

  if (authLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!note) {
    return notFound();
  }

  return <NoteEditor note={note} />;
}
