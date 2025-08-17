
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

export default function SettingsPage() {
  const { user, userProfile, loading } = useAuth();
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      setNotionDatabaseId(userProfile.notionDatabaseId || '');
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
    if (!notionDatabaseId) {
        toast({ title: 'Database ID cannot be empty', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            notionDatabaseId: notionDatabaseId.trim(),
        });
        toast({ title: 'Settings saved!', description: 'Your Notion Database ID has been updated.'});
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
          <p className="text-muted-foreground">Manage your app preferences.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>
            Connect your Notion account to seamlessly sync your tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
              <Label htmlFor="notion-database-id">Notion Database ID</Label>
              <Input
                id="notion-database-id"
                placeholder="e.g., a1b2c3d4e5f61234567890abcdef123456"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
              />
               <p className="text-xs text-muted-foreground">
                Find this in your Notion database URL. It's the 32-character part after your workspace name and before the '?'.
                <br/>
                Example: `notion.so/your-workspace/`**`a1b2c3d4e5f61234567890abcdef123456`**`?v=...`
              </p>
            </div>
            <div>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Save
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
