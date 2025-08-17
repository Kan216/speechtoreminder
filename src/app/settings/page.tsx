
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      setApiKey(userProfile.notionApiKey || '');
      setDatabaseId(userProfile.notionDatabaseId || '');
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notionApiKey: apiKey,
        notionDatabaseId: databaseId,
      });
      toast({
        title: 'Settings Saved',
        description: 'Your Notion credentials have been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error Saving Settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
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
          <p className="text-muted-foreground">Manage your integrations and preferences.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>
            Connect your Notion account to sync tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How to Get Your Credentials</AlertTitle>
            <AlertDescription>
                <ol className="list-decimal list-inside space-y-2">
                    <li>Get your API Key from your <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Notion Integrations</a> page.</li>
                    <li>Create a new database in Notion and **share it** with your integration.</li>
                    <li>
                        Copy the **Database ID** from the URL. It's the long string of characters between your workspace name and the question mark.
                        <div className="mt-2 p-2 rounded-md bg-muted text-muted-foreground text-xs">
                           <p>https://www.notion.so/your-workspace/<strong className="text-primary">DATABASE_ID</strong>?v=...</p>
                           <p>Only copy the ID part, not the full URL.</p>
                        </div>
                    </li>
                     <li>Make sure your database has columns named exactly: `Name` (Title), `Status` (Select), and `Due Date` (Date).</li>
                </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Notion API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="secret_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="databaseId">Notion Database ID</Label>
            <Input
              id="databaseId"
              placeholder="Paste your 32-character Notion Database ID here"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Credentials
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
