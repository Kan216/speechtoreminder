
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      setNotionApiKey(userProfile.notionApiKey || '');
      setNotionDatabaseId(userProfile.notionDatabaseId || '');
      setGeminiApiKey(userProfile.geminiApiKey || '');
    }
  }, [userProfile]);
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) {
        toast({ title: 'You must be logged in', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            notionApiKey: notionApiKey.trim(),
            notionDatabaseId: notionDatabaseId.trim(),
            geminiApiKey: geminiApiKey.trim(),
        });
        toast({ title: 'Settings saved!', description: 'Your credentials have been updated.'});
    } catch(error: any) {
        toast({ title: 'Error saving settings', description: error.message, variant: 'destructive'});
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your app preferences and integrations.</p>
        </div>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Provide your own API keys for the services used in this application. Your credentials are saved securely to your user profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="gemini-api-key">Gemini API Key</Label>
                 <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <Input
                        id="gemini-api-key"
                        type="password"
                        placeholder="Enter your Google AI Studio API Key"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                    />
                </div>
                 <p className="text-xs text-muted-foreground">
                    Get your key from {' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                        Google AI Studio
                    </a>.
                </p>
            </div>
             <div>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Save API Keys
                </Button>
            </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>
            Connect your Notion account to seamlessly sync your tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Instructions</AlertTitle>
                <AlertDescription>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>
                            Create a new Notion integration <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline font-semibold">here</a> to get your API Key.
                        </li>
                        <li>Create a new database in Notion (or use an existing one).</li>
                        <li>Share the database with your integration (click the `...` menu on the database page).</li>
                        <li>
                            Copy the **Database ID**. It's the 32-character part of the URL (without dashes). You can also paste the full URL.
                            <br />
                            <code className="text-xs bg-muted p-1 rounded-sm">
                                https://www.notion.so/your-workspace/<strong className="text-primary">a1b2c3d4e5f61234567890abcdef123456</strong>?v=...
                            </code>
                        </li>
                    </ol>
                </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor="notion-api-key">Notion API Key</Label>
                <Input
                    id="notion-api-key"
                    type="password"
                    placeholder="e.g., secret_********************************"
                    value={notionApiKey}
                    onChange={(e) => setNotionApiKey(e.target.value)}
                />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notion-database-id">Notion Database ID or URL</Label>
              <Input
                id="notion-database-id"
                placeholder="e.g., a1b2c3d4e5f61234567890abcdef123456"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
              />
            </div>
            <div>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Save Credentials
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
