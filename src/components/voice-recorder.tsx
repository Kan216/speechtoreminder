
'use client'

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2, Star } from 'lucide-react';
import { createTaskFromVoice } from '@/ai/flows/create-task-from-voice';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"

const FREE_TIER_DAILY_LIMIT = 2;

export default function VoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const handleCreditCheck = async () => {
        if (!user || !userProfile) return false;

        const { subscriptionTier, lastCreditReset, dailyVoiceCreditsUsed } = userProfile;
        
        if (subscriptionTier === 'premium') {
            return true;
        }

        const today = new Date();
        const lastResetDate = (lastCreditReset as Timestamp)?.toDate();

        const isNewDay = lastResetDate.toDateString() !== today.toDateString();

        if (isNewDay) {
            await updateDoc(doc(db, 'users', user.uid), {
                dailyVoiceCreditsUsed: 0,
                lastCreditReset: Timestamp.now()
            });
            return true;
        }

        if (dailyVoiceCreditsUsed >= FREE_TIER_DAILY_LIMIT) {
            setShowUpgradeDialog(true);
            return false;
        }

        return true;
    }

    const startRecording = async () => {
        if (!user) {
            toast({
                title: 'Authentication Required',
                description: 'You must be signed in to record a voice note.',
                variant: 'destructive',
            });
            return;
        }
        
        if (!userProfile?.geminiApiKey) {
            toast({
                title: 'Gemini API Key Required',
                description: 'Please set your Gemini API key in Settings to use voice notes.',
                variant: 'destructive',
            });
            router.push('/settings');
            return;
        }
        
        const hasCredits = await handleCreditCheck();
        if (!hasCredits) {
             setIsDialogOpen(false);
             return;
        }

        setIsDialogOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            recorder.onstop = () => {
                handleStopRecording(stream);
            };

            audioChunksRef.current = [];
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            toast({
                title: 'Microphone Error',
                description: 'Could not access the microphone. Please check your browser permissions.',
                variant: 'destructive',
            });
            setIsDialogOpen(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleStopRecording = async (stream: MediaStream) => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsTranscribing(true);

        if (audioChunksRef.current.length === 0 || !user || !userProfile?.geminiApiKey) {
            setIsTranscribing(false);
            setIsDialogOpen(false);
            return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            try {
                const { taskTitle, subtasks } = await createTaskFromVoice({ 
                    audioDataUri: base64Audio,
                    userId: user.uid,
                    apiKey: userProfile.geminiApiKey!,
                });
                
                const subtasksWithIds = subtasks.map(subtask => ({
                    id: uuidv4(),
                    text: subtask,
                    completed: false
                }));

                const newNoteRef = await addDoc(collection(db, 'users', user.uid, 'notes'), {
                    title: taskTitle,
                    subtasks: subtasksWithIds,
                    progress: 0,
                    status: 'pending',
                    user_id: user.uid,
                    created_at: serverTimestamp(),
                });
                
                if (userProfile.subscriptionTier === 'free') {
                    await updateDoc(doc(db, 'users', user.uid), {
                        dailyVoiceCreditsUsed: increment(1)
                    });
                }

                toast({
                    title: 'Task Created!',
                    description: `Your new task "${taskTitle}" has been created.`,
                });
                router.push(`/notes/${newNoteRef.id}`);
                
            } catch (error) {
                console.error('Task creation failed:', error);
                toast({
                    title: 'Task Creation Failed',
                    description: 'Could not create a task from the voice note. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsTranscribing(false);
                setIsDialogOpen(false);
            }
        };
    };

    const handleCancel = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            const stream = mediaRecorderRef.current.stream;
            mediaRecorderRef.current.stop();
            stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
        setIsDialogOpen(false);
        setIsTranscribing(false);
    }
    
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        }
    }, []);

    return (
        <>
            <Button onClick={startRecording}>
                <Mic className="mr-2 h-4 w-4" />
                Create with Voice
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent onEscapeKeyDown={handleCancel} onPointerDownOutside={handleCancel}>
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl">Voice Task Creation</DialogTitle>
                        <DialogDescription className="text-center">
                            {isRecording ? "Recording in progress..." : isTranscribing ? "Processing your request..." : "Start speaking..."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <div className={`relative flex items-center justify-center h-32 w-32 rounded-full ${isRecording ? 'bg-red-500/20' : 'bg-primary/10'}`}>
                           <div className={`h-24 w-24 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-primary'}`}>
                                {isTranscribing ? <Loader2 className="h-10 w-10 animate-spin text-white" /> : <Mic className="h-10 w-10 text-white" />}
                           </div>
                        </div>
                        <p className="text-muted-foreground">{isRecording ? "Tap button to stop" : ""}</p>
                    </div>
                     <Button onClick={stopRecording} disabled={!isRecording} variant="destructive">
                        <StopCircle className="mr-2 h-4 w-4" /> Stop Recording
                    </Button>
                </DialogContent>
            </Dialog>

            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl">Daily Limit Reached</DialogTitle>
                        <DialogDescription className="text-center">
                            You've used all your free voice credits for today.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                         <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Star className="h-8 w-8 text-primary" />
                        </div>
                        <p className="text-center text-muted-foreground">Upgrade to Premium for unlimited voice notes, plus other exclusive features!</p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowUpgradeDialog(false)} variant="ghost">Maybe Later</Button>
                        <Button onClick={() => {
                            toast({ title: "Coming Soon!", description: "The premium plan is not yet available."});
                            setShowUpgradeDialog(false);
                        }}>
                           <Star className="mr-2 h-4 w-4"/> Upgrade to Premium
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
