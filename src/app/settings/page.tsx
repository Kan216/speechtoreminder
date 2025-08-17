
'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your app preferences.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Integration settings, like for Notion, are now managed directly when you use the feature for the first time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">To connect to Notion, open any task and click the "Sync to Notion" button.</p>
        </CardContent>
      </Card>
    </div>
  );
}
