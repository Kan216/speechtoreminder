'use client';

import MainSidebar from '@/components/main-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Loader2 } from 'lucide-react';

type Note = {
  id: string;
  title: string;
  created_at: Timestamp;
};

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      redirect('/auth');
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'notes'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Note[];
      setNotes(notesData);
      setNotesLoading(false);
      setNotesError(null);
    },
    (error) => {
      console.error("Error fetching notes:", error);
      setNotesError(error.message);
      setNotesLoading(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <MainSidebar user={user} notes={notes} notesLoading={notesLoading} notesError={notesError}/>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
