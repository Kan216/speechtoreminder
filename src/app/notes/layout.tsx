'use client';

import MainSidebar from '@/components/main-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { redirect } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';

import { Loader2 } from 'lucide-react';


export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, notes, notesLoading, notesError } = useAuth();
  useNotifications(notes);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
     redirect('/auth');
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
