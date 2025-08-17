'use server';

/**
 * @fileOverview A voice note transcription AI agent.
 *
 * - transcribeVoiceNote - A function that handles the voice note transcription process.
 * - TranscribeVoiceNoteInput - The input type for the transcribeVoiceNote function.
 * - TranscribeVoiceNoteOutput - The return type for the transcribeVoiceNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeVoiceNoteInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'A recording of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type TranscribeVoiceNoteInput = z.infer<typeof TranscribeVoiceNoteInputSchema>;

const TranscribeVoiceNoteOutputSchema = z.object({
  transcription: z.string().describe('The transcription of the audio data.'),
});
export type TranscribeVoiceNoteOutput = z.infer<typeof TranscribeVoiceNoteOutputSchema>;

export async function transcribeVoiceNote(input: TranscribeVoiceNoteInput): Promise<TranscribeVoiceNoteOutput> {
  return transcribeVoiceNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'transcribeVoiceNotePrompt',
  input: {schema: TranscribeVoiceNoteInputSchema},
  output: {schema: TranscribeVoiceNoteOutputSchema},
  prompt: `Transcribe the following voice note into text:

{{media url=audioDataUri}}`,
});

const transcribeVoiceNoteFlow = ai.defineFlow(
  {
    name: 'transcribeVoiceNoteFlow',
    inputSchema: TranscribeVoiceNoteInputSchema,
    outputSchema: TranscribeVoiceNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
