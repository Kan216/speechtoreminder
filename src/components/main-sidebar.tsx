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
  Search,
  PlusCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useRouter, useParams } from 'next/navigation';
import { Input } from './ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type Note = {
  id: string;
  title: string | null;
  created_at: Timestamp;
};

interface MainSidebarProps {
  user: User;
  notes: Note[];
  notesLoading: boolean;
}

export default function MainSidebar({ user, notes, notesLoading }: MainSidebarProps) {
  const router = useRouter();
  const params = useParams();
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
            title: 'Untitled Note',
            content: '',
            formatted_content: null,
            created_at: serverTimestamp(),
            user_id: user.uid
        });
        router.push(`/notes/${docRef.id}`);
    } catch (error: any) {
        toast({
            title: "Error creating note",
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
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
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
        <div className="mb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8" />
          </div>
        </div>

        <div className="mb-2">
            <Button variant="default" className="w-full" onClick={handleNewNote} disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                New Note
            </Button>
        </div>
        
        <SidebarGroup className='p-0'>
          <SidebarGroupLabel>Notes</SidebarGroupLabel>
          <SidebarMenu>
            {notesLoading ? (
              <>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
              </>
            ) : (
                notes.map((note) => (
                <SidebarMenuItem key={note.id}>
                    <Button asChild variant="ghost" className="w-full justify-start" data-active={noteId === note.id}>
                        <Link href={`/notes/${note.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span className="truncate">{note.title || 'Untitled Note'}</span>
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
