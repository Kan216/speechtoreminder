'use client'

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  PlusCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Settings,
  Home,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Note } from '@/hooks/use-auth';

interface MainSidebarProps {
  user: User;
  notes: Note[];
  notesLoading: boolean;
  notesError: string | null;
}

export default function MainSidebar({ user, notes, notesLoading, notesError }: MainSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const noteId = params.noteId as string;
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/auth');
  };
  
  const handleNewNote = async () => {
    setIsCreating(true);
    try {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'notes'), {
            title: 'Untitled Task',
            content: '',
            subtasks: [],
            progress: 0,
            status: 'pending',
            created_at: serverTimestamp(),
            user_id: user.uid
        });
        router.push(`/notes/${docRef.id}`);
    } catch (error: any) {
        toast({
            title: "Error creating task",
            description: error.message,
            variant: "destructive"
        })
    } finally {
        setIsCreating(false);
    }
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.photoURL ?? undefined} />
            <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              {user.displayName ?? user.email}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button asChild variant="ghost" className="w-full justify-start" data-active={pathname === '/notes'}>
              <Link href="/notes">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button variant="default" className="w-full" onClick={handleNewNote} disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                New Task
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SidebarGroup className='p-0 mt-4'>
          <SidebarGroupLabel>Tasks</SidebarGroupLabel>
          <SidebarMenu>
            {notesLoading ? (
              <>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
              </>
            ) : notesError ? (
                <div className="p-4 text-xs text-destructive-foreground bg-destructive/80 rounded-md m-2 space-y-2">
                    <div className='flex items-center gap-2 font-bold'>
                        <AlertTriangle className='h-4 w-4' />
                        <p>Permission Error</p>
                    </div>
                    <p>Could not load tasks. Please update your Firestore security rules to allow listing tasks.</p>
                </div>
            ) : (
                notes.map((note) => (
                <SidebarMenuItem key={note.id}>
                    <Button asChild variant="ghost" className="w-full justify-start" data-active={noteId === note.id}>
                        <Link href={`/notes/${note.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span className="truncate">{note.title || 'Untitled Task'}</span>
                        </Link>
                    </Button>
                </SidebarMenuItem>
                ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
            <SidebarMenuItem>
                <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </Button>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
