import MainSidebar from '@/components/main-sidebar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';

export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <SidebarProvider>
      <Sidebar>
        <MainSidebar user={user} notes={notes ?? []} />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
