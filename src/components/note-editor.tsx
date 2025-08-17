
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Check, CalendarPlus, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Note } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { syncToNotion } from '@/ai/flows/sync-to-notion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';


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

export default function NoteEditor({ note: initialNote }: {note: Note}) {
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNotionDialogOpen, setIsNotionDialogOpen] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');

  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  useEffect(() => {
    if (isNotionDialogOpen) {
      setNotionApiKey(userProfile?.notionApiKey || '');
      setNotionDatabaseId(userProfile?.notionDatabaseId || '');
    }
  }, [isNotionDialogOpen, userProfile]);

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
        toast({ title: 'Error saving note', description: error.message, variant: 'destructive' });
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

  const handleDueDateChange = (date: Date | undefined) => {
    if (!date) return;
    const newDueDate = date.toISOString();
    setNote(prev => ({ ...prev, dueDate: newDueDate }));
    saveNote({ dueDate: newDueDate });
  }
  
  const handleDeleteNote = async () => {
    const noteRef = getNoteRef();
    if (!noteRef) return;
    
    if (!confirm('Are you sure you want to delete this task?')) return;

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
    if (note.subtasks.length > 0 && note.subtasks.some(s => !s.completed)) {
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

   const handleNotionSync = async () => {
    setIsSyncing(true);
    try {
      const apiKey = userProfile?.notionApiKey;
      const dbId = userProfile?.notionDatabaseId;

      if (!apiKey || !dbId) {
        setIsNotionDialogOpen(true);
        setIsSyncing(false);
        return;
      }
      
      const plainNote = {
        ...note,
        created_at: note.created_at.toDate().toISOString(),
      };

      const result = await syncToNotion({
        note: plainNote,
        notionApiKey: apiKey,
        notionDatabaseId: dbId,
      });

      if (result.success) {
        toast({
          title: 'Synced to Notion!',
          description: (
            <p>
                Your task has been sent to Notion. 
                <a href={result.pageUrl} target="_blank" rel="noopener noreferrer" className="underline ml-1">View it here</a>.
            </p>
          ),
        });
      } else {
        toast({
          title: 'Notion Sync Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An unknown error occurred during sync.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveNotionCredentials = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        notionApiKey: notionApiKey,
        notionDatabaseId: notionDatabaseId,
      });
      toast({ title: 'Credentials Saved', description: 'Your Notion credentials have been saved.' });
      setIsNotionDialogOpen(false);
      handleNotionSync(); // Retry syncing after saving
    } catch (error: any) {
       toast({ title: 'Error Saving Credentials', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-full flex-col p-4 md:p-6 lg:p-8 space-y-6 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <p>Task</p>
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
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        {note.dueDate ? format(new Date(note.dueDate), 'PPP') : 'Schedule'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={note.dueDate ? new Date(note.dueDate) : undefined}
                        onSelect={handleDueDateChange}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleNotionSync} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Share2 className="mr-2 h-4 w-4" />}
                Sync to Notion
            </Button>
            
            <Button variant="ghost" size="icon" onClick={handleDeleteNote} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>To-do list</CardTitle>
                <CardDescription>Break your main task into smaller, manageable steps.</CardDescription>
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
                    <p className="text-muted-foreground text-center py-10">No sub-tasks for this item. Created by voice note?</p>
                )}
            </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="text-center">
                 <CardHeader>
                    <CardTitle>Progress</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="relative h-40 w-40 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-gray-200 dark:text-gray-700"
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
      <Dialog open={isNotionDialogOpen} onOpenChange={setIsNotionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to Notion</DialogTitle>
            <DialogDescription>
              Please provide your Notion API Key and Database ID to sync your tasks. This information will be stored securely in your user profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notion-api-key">Notion API Key</Label>
              <Input
                id="notion-api-key"
                type="password"
                placeholder="secret_..."
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can get this from{' '}
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">
                  your Notion integrations page
                </a>
                .
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notion-database-id">Notion Database ID</Label>
              <Input
                id="notion-database-id"
                placeholder="The 32 character ID from your database URL"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
              />
               <p className="text-xs text-muted-foreground">
                This is the 32-character ID from your database URL. (e.g., notion.so/workspace/
                <strong>a1b2c3d4e5f61234567890abcdef123456</strong>?v=...).
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveNotionCredentials}>Save and Sync</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
