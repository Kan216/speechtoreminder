import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NoteEditor from '@/components/note-editor';
import { notFound } from 'next/navigation';

export default async function NotePage({ params }: { params: { noteId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { data: note, error } = await supabase
    .from('notes')
    .select('id, title, content, formatted_content, created_at')
    .eq('id', params.noteId)
    .eq('user_id', user.id)
    .single();

  if (error || !note) {
    return notFound();
  }

  return <NoteEditor note={note} />;
}
