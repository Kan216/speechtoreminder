'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { formatNote } from '@/ai/flows/format-note';
import { Wand2, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

type Note = {
  id: string;
  title: string;
  content: string;
  formatted_content: string | null;
  created_at: Timestamp;
};

interface NoteEditorProps {
  note: Note;
}

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

export default function NoteEditor({ note: initialNote }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const getNoteRef = useCallback(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'notes', note.id);
  }, [user, note.id]);
  
  const saveNote = useCallback(async (updatedNote: Partial<Note>) => {
    const noteRef = getNoteRef();
    if (!noteRef) return;

    setIsSaving(true);
    try {
        await updateDoc(noteRef, updatedNote);
    } catch(error: any) {
        toast({ title: 'Error saving note', description: error.message, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }, [getNoteRef, toast]);
  
  const debouncedSave = useMemo(() => debounce(saveNote, 1000), [saveNote]);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setNote(prev => ({ ...prev, title: newTitle }));
    debouncedSave({ title: newTitle });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNote(prev => ({ ...prev, content: newContent, formatted_content: null }));
    debouncedSave({ content: newContent, formatted_content: null });
  };
  
  const handleFormatNote = async () => {
    if (!note.content) {
        toast({ title: 'Note is empty', description: 'There is no content to format.'});
        return;
    }
    setIsFormatting(true);
    try {
        const { formattedNote } = await formatNote({ noteContent: note.content });
        setNote(prev => ({ ...prev, formatted_content: formattedNote }));
        await saveNote({ formatted_content: formattedNote });
        toast({ title: 'Note Formatted!', description: 'AI has magically formatted your note.'});
    } catch(e) {
        toast({ title: 'Formatting Failed', description: 'Could not format the note.', variant: 'destructive'});
    } finally {
        setIsFormatting(false);
    }
  };

  const handleDeleteNote = async () => {
    const noteRef = getNoteRef();
    if (!noteRef) return;
    
    setIsDeleting(true);
    try {
        await deleteDoc(noteRef);
        toast({ title: 'Note deleted' });
        router.push('/notes');
    } catch(error: any) {
      toast({ title: 'Error deleting note', description: error.message, variant: 'destructive' });
      setIsDeleting(false);
    }
  }

  const creationDate = note.created_at?.toDate ? note.created_at.toDate() : new Date();

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8 space-y-4 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Input
          value={note.title || ''}
          onChange={handleTitleChange}
          placeholder="Note Title"
          className="text-2xl font-bold font-headline border-none shadow-none focus-visible:ring-0 p-0 flex-grow"
        />
        <div className="flex items-center gap-2 self-end sm:self-center">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button variant="outline" onClick={handleFormatNote} disabled={isFormatting || !!note.formatted_content}>
                {isFormatting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Smart Format
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDeleteNote} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
        </div>
      </div>
      
      <div className="flex-grow rounded-lg border bg-card p-1">
        {note.formatted_content ? (
          <div className="p-3 overflow-y-auto h-full" dangerouslySetInnerHTML={{ __html: note.formatted_content }} />
        ) : (
          <Textarea
            value={note.content || ''}
            onChange={handleContentChange}
            placeholder="Start writing or record a voice note..."
            className="h-full w-full resize-none border-none shadow-none focus-visible:ring-0 p-3 text-base leading-relaxed"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Created on {creationDate.toLocaleDateString()}
      </p>
    </div>
  );
}
