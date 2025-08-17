'use client'

import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Separator } from '@/components/ui/separator'

export function AuthForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/notes')
    } catch (error: any) {
      toast({
        title: 'Error signing in',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async () => {
    setIsSubmitting(true)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
       toast({
        title: 'Success!',
        description: 'You have signed up successfully. Please sign in.',
      })
    } catch (error: any) {
      toast({
        title: 'Error signing up',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    try {
      await signInWithPopup(auth, provider);
      router.push('/notes');
    } catch (error: any) {
      toast({
        title: 'Error with Google Sign-In',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
       <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.4 56.2L368.6 128H314c-56.3 0-104 44.4-104 99.4 0 26.5 10.5 50.4 27.8 67.8 17.4 17.4 41.3 27.8 67.8 27.8h11.2c-15.3 46.4-58.4 84.1-111.6 84.1-65.4 0-118.5-53.1-118.5-118.5s53.1-118.5 118.5-118.5c32.4 0 61.1 13.1 82.7 34.3l48.2-48.2C372.1 63.9 315.6 32 248 32 124.7 32 32 124.7 32 248s92.7 216 216 216c120.7 0 216-91.5 216-204.2 0-14.3-1.3-28.5-3.6-42.2z"></path></svg>
          )}
          Sign in with Google
        </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
            minLength={6}
          />
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
          <Button type="button" variant="secondary" onClick={handleSignUp} className="w-full" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign Up
          </Button>
        </div>
      </form>
    </div>
  )
}
