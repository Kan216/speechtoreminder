// src/ai/flows/format-note.ts
'use server';
/**
 * @fileOverview A note formatting AI agent.
 *
 * - formatNote - A function that handles the note formatting process.
 * - FormatNoteInput - The input type for the formatNote function.
 * - FormatNoteOutput - The return type for the formatNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormatNoteInputSchema = z.object({
  noteContent: z.string().describe('The content of the note to be formatted.'),
});
export type FormatNoteInput = z.infer<typeof FormatNoteInputSchema>;

const FormatNoteOutputSchema = z.object({
  formattedNote: z.string().describe('The formatted note content.'),
});
export type FormatNoteOutput = z.infer<typeof FormatNoteOutputSchema>;

export async function formatNote(input: FormatNoteInput): Promise<FormatNoteOutput> {
  return formatNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'formatNotePrompt',
  input: {schema: FormatNoteInputSchema},
  output: {schema: FormatNoteOutputSchema},
  prompt: `You are an AI assistant designed to format notes to improve their readability and organization.

  Please format the following note content, paying attention to:
  - Adding headings and subheadings where appropriate.
  - Using bullet points or numbered lists for items in a series.
  - Ensuring proper grammar and punctuation.
  - Removing any unnecessary or redundant information.

  Note Content: {{{noteContent}}}`,
});

const formatNoteFlow = ai.defineFlow(
  {
    name: 'formatNoteFlow',
    inputSchema: FormatNoteInputSchema,
    outputSchema: FormatNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
