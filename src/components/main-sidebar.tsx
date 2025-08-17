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
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { Input } from './ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type Note = {
  id: string;
  title: string | null;
  created_at: string;
};

interface MainSidebarProps {
  user: User;
  notes: Note[];
}

export default function MainSidebar({ user, notes }: MainSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  };
  
  const handleNewNote = async () => {
    setIsCreating(true);
    const { data, error } = await supabase
      .from('notes')
      .insert({ title: 'Untitled Note', content: '', user_id: user.id })
      .select('id')
      .single();

    setIsCreating(false);
    if (data) {
      router.push(`/notes/${data.id}`);
      router.refresh(); // This will re-fetch notes in the layout
    } else {
        toast({
            title: "Error creating note",
            description: error.message,
            variant: "destructive"
        })
    }
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata.avatar_url} />
            <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              {user.user_metadata.full_name ?? user.email}
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
            {notes.map((note) => (
              <SidebarMenuItem key={note.id}>
                <Button asChild variant="ghost" className="w-full justify-start" data-active={params.noteId === note.id}>
                    <Link href={`/notes/${note.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="truncate">{note.title || 'Untitled Note'}</span>
                    </Link>
                </Button>
              </SidebarMenuItem>
            ))}
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
