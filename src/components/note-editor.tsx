
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Check, Calendar as CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Note, Subtask } from '@/app/notes/[noteId]/page';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface NoteEditorProps {
  note: Note;
  onSyncToCalendar: () => void;
  isSyncing: boolean;
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

export default function NoteEditor({ note: initialNote, onSyncToCalendar, isSyncing }: NoteEditorProps) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

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
        console.error("Error saving note:", error);
        let description = "An unknown error occurred.";
        if (error.code === 'permission-denied') {
            description = "You don't have permission to save this note. Please check your Firestore security rules."
        } else {
            description = error.message;
        }
        toast({ title: 'Error saving note', description, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }, [getNoteRef, toast]);
  
  const debouncedSave = useMemo(() => debounce(saveNote, 1000), [saveNote]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setNote(prev => ({ ...prev, title: newTitle }));
    debouncedSave({ title: newTitle });
  };
  
  const handleDeleteNote = async () => {
    const noteRef = getNoteRef();
    if (!noteRef) return;
    
    setIsDeleting(true);
    try {
        await deleteDoc(noteRef);
        toast({ title: 'Task deleted' });
        router.push('/notes');
    } catch(error: any) {
      toast({ title: 'Error deleting task', description: error.message, variant: 'destructive' });
      setIsDeleting(false);
    }
  }

  const handleSubtaskChange = (subtaskId: string, completed: boolean) => {
    const newSubtasks = note.subtasks.map(subtask => 
      subtask.id === subtaskId ? { ...subtask, completed } : subtask
    );
    const completedCount = newSubtasks.filter(s => s.completed).length;
    const progress = newSubtasks.length > 0 ? Math.round((completedCount / newSubtasks.length) * 100) : 0;
    const status = progress === 100 ? 'finished' : progress > 0 ? 'inprogress' : 'pending';
    
    const updatedNote = { ...note, subtasks: newSubtasks, progress, status };
    setNote(updatedNote);
    saveNote({ subtasks: newSubtasks, progress, status });
  };

  const handleMarkAsFinished = () => {
    const allCompleted = note.subtasks.every(s => s.completed);
    if(!allCompleted) {
      toast({
        title: "Not all subtasks are complete",
        description: "Please complete all subtasks before marking as finished.",
        variant: 'destructive',
      })
      return;
    }
    const updatedNote = { ...note, status: 'finished', progress: 100 };
    setNote(updatedNote);
    saveNote({ status: 'finished', progress: 100 });
    toast({ title: 'Task Finished!', description: 'Great job!'});
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8 space-y-6 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <p>Task today</p>
            {note.dueDate && (
              <p className='font-semibold text-primary'>{format(new Date(note.dueDate), "PPP p")}</p>
            )}
          </div>
          <Input
            value={note.title || ''}
            onChange={handleTitleChange}
            placeholder="Task Title"
            className="text-3xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button variant="outline" size="icon" onClick={onSyncToCalendar} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarIcon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDeleteNote} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>To-do list</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {note.subtasks && note.subtasks.length > 0 ? (
                    note.subtasks.map(subtask => (
                        <div key={subtask.id} className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-lg">
                            <Checkbox 
                                id={`subtask-${subtask.id}`} 
                                checked={subtask.completed} 
                                onCheckedChange={(checked) => handleSubtaskChange(subtask.id, !!checked)}
                            />
                            <Label 
                                htmlFor={`subtask-${subtask.id}`}
                                className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {subtask.text}
                            </Label>
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-center py-4">No sub-tasks for this item.</p>
                )}
            </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="text-center">
                <CardContent className="p-6">
                    <div className="relative h-40 w-40 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-gray-200"
                                strokeWidth="10"
                                stroke="currentColor"
                                fill="transparent"
                                r="45"
                                cx="50"
                                cy="50"
                            />
                            <circle
                                className="text-primary"
                                strokeWidth="10"
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="45"
                                cx="50"
                                cy="50"
                                strokeDasharray={`${2 * Math.PI * 45}`}
                                strokeDashoffset={`${2 * Math.PI * 45 * (1 - (note.progress || 0) / 100)}`}
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-primary">
                            {note.progress || 0}%
                        </span>
                    </div>
                </CardContent>
            </Card>
            <Button size="lg" className="w-full" onClick={handleMarkAsFinished} disabled={note.status === 'finished'}>
                <Check className="mr-2 h-5 w-5" />
                {note.status === 'finished' ? 'Completed!' : 'Mark as finished'}
            </Button>
        </div>
      </div>
    </div>
  );
}
