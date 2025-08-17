import { Mic, Zap } from 'lucide-react';
import VoiceRecorder from '@/components/voice-recorder';

export default function NotesDefaultPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mic className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold font-headline text-foreground/90">Start a new note</h1>
        <p className="mt-2 text-muted-foreground">
          Select a note from the sidebar, or create a new one. Try recording a voice note to see the magic happen.
        </p>
        <div className="mt-8">
            <VoiceRecorder />
        </div>
        <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground/80">
            <Zap className="mr-2 h-4 w-4" />
            <p>Powered by AI Transcription & Formatting</p>
        </div>
      </div>
    </div>
  );
}
