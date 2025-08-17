'use client'

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';
import { transcribeVoiceNote } from '@/ai/flows/transcribe-voice-note';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function VoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const supabase = createClient();
    const router = useRouter();
    const { toast } = useToast();

    const startRecording = async () => {
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
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    const { data: newNote, error } = await supabase
                        .from('notes')
                        .insert({
                            title: transcription.substring(0, 40) + (transcription.length > 40 ? '...' : ''),
                            content: transcription,
                            user_id: user.id
                        })
                        .select('id')
                        .single();

                    if (error) throw error;

                    toast({
                        title: 'Transcription Complete!',
                        description: 'Your new note has been created.',
                    });
                    router.push(`/notes/${newNote.id}`);
                    router.refresh();
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
            {!isRecording ? (
                <Button onClick={startRecording} disabled={isTranscribing} size="lg" className="rounded-full w-24 h-24 shadow-lg transition-all hover:scale-105 active:scale-95">
                    {isTranscribing ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                        <Mic className="h-8 w-8" />
                    )}
                </Button>
            ) : (
                <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full w-24 h-24 shadow-lg animate-pulse">
                    <StopCircle className="h-8 w-8" />
                </Button>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
                {isRecording ? "Recording... Click to stop." : isTranscribing ? "Transcribing..." : "Tap to record"}
            </p>
        </div>
    );
}
