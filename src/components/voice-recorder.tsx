
'use client'

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';
import { transcribeVoiceNote } from '@/ai/flows/transcribe-voice-note';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function VoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const startRecording = async () => {
        if (!user) {
            toast({
                title: 'Authentication Required',
                description: 'You must be signed in to record a voice note.',
                variant: 'destructive',
            });
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
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
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleRecordingToggle = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleStopRecording = async (stream: MediaStream) => {
        stream.getTracks().forEach(track => track.stop()); // Stop the microphone access
        setIsRecording(false);
        setIsTranscribing(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            try {
                const { transcription } = await transcribeVoiceNote({ audioDataUri: base64Audio });

                if (user) {
                    const newNoteRef = await addDoc(collection(db, 'users', user.uid, 'notes'), {
                        title: transcription.substring(0, 40) + (transcription.length > 40 ? '...' : ''),
                        content: transcription,
                        formatted_content: null,
                        user_id: user.uid,
                        created_at: serverTimestamp()
                    });

                    toast({
                        title: 'Transcription Complete!',
                        description: 'Your new note has been created.',
                    });
                    router.push(`/notes/${newNoteRef.id}`);
                }
            } catch (error) {
                console.error('Transcription failed:', error);
                toast({
                    title: 'Transcription Failed',
                    description: 'Could not transcribe the voice note. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsTranscribing(false);
            }
        };
    };

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div>
            <Button onClick={handleRecordingToggle} disabled={isTranscribing} size="lg" className="rounded-full w-24 h-24 shadow-lg transition-all hover:scale-105 active:scale-95">
                {isRecording ? (
                    <StopCircle className="h-8 w-8" />
                ) : isTranscribing ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                    <Mic className="h-8 w-8" />
                )}
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
                {isRecording ? "Recording... Tap to stop." : isTranscribing ? "Transcribing..." : user ? "Tap to record" : "Sign in to record"}
            </p>
        </div>
    );
}
