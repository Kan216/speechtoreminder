'use client';

import { redirect } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckSquare } from 'lucide-react';

export default function AuthPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user) {
    redirect('/notes');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-3xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckSquare className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">TaskGoal</CardTitle>
          <CardDescription>Welcome! Sign in or create an account to start.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  );
}
