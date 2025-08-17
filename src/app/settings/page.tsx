
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const getUserSettings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNotionApiKey(data.notionApiKey || '');
        setNotionDatabaseId(data.notionDatabaseId || '');
      }
    } catch (error: any) {
      toast({
        title: 'Error fetching settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      redirect('/auth');
    } else {
      getUserSettings();
    }
  }, [user, authLoading, getUserSettings]);

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notionApiKey: notionApiKey,
        notionDatabaseId: notionDatabaseId,
      });
      toast({
        title: 'Settings Saved',
        description: 'Your Notion integration settings have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
       <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      <Card>
        <form onSubmit={handleSaveSettings}>
            <CardHeader>
            <CardTitle>Notion Integration</CardTitle>
            <CardDescription>
                Connect your Notion account to sync tasks. 
                <Button variant="link" asChild className="p-1 h-auto">
                    <Link href="https://www.notion.so/my-integrations" target="_blank">
                        Find your API key and create a database here.
                    </Link>
                </Button>
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="notion-api-key">Notion API Key</Label>
                <Input
                id="notion-api-key"
                type="password"
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                placeholder="secret_..."
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="notion-database-id">Notion Database ID</Label>
                <Input
                id="notion-database-id"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="The long string in your database URL"
                />
            </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
