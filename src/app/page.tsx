'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceRecorder from '@/components/voice-recorder';
import { FileText, Loader2, BarChart2 } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, notes, notesLoading } = useAuth();

  const pendingTasks = notes.filter(note => {
    const totalSubtasks = note.subtasks?.length || 0;
    if (totalSubtasks === 0) return note.status !== 'finished';
    const completedSubtasks = note.subtasks?.filter(s => s.completed).length || 0;
    return completedSubtasks < totalSubtasks;
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hi, Welcome back {user?.displayName || user?.email?.split('@')[0]}!</h2>
          <p className="text-muted-foreground">Here's a list of your tasks for this month!</p>
        </div>
        <div className="flex items-center space-x-2">
          <VoiceRecorder />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {notesLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{notes.length}</div>}
            <p className="text-xs text-muted-foreground">All tasks you have created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {notesLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{pendingTasks.length}</div>}
            <p className="text-xs text-muted-foreground">Tasks that are not finished yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {notesLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">{Math.round((notes.reduce((acc, n) => acc + (n.progress || 0), 0) / (notes.length || 1)))}%</div>}
            <p className="text-xs text-muted-foreground">Average completion of all tasks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          {notesLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : notes.length > 0 ? (
            <ul className="space-y-2">
              {notes.map(note => (
                <li key={note.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
                  <Link href={`/notes/${note.id}`} className="font-semibold hover:underline">
                    {note.title || 'Untitled Task'}
                  </Link>
                  <div className="text-sm text-muted-foreground">{note.progress || 0}%</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-10">You have no tasks yet. Create one!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
