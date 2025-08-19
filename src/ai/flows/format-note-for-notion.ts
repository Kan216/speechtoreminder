'use server';

/**
 * @fileOverview An AI agent for formatting a note for Notion.
 *
 * - formatNoteForNotion - A function that refines a task's title and extracts a reminder date/time.
 * - FormatNoteForNotionInput - The input type for the function.
 * - FormatNoteForNotionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormatNoteForNotionInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  subtasks: z.array(z.string()).describe('A list of sub-tasks or to-do items.'),
});
export type FormatNoteForNotionInput = z.infer<typeof FormatNoteForNotionInputSchema>;

const FormatNoteForNotionOutputSchema = z.object({
  formattedTitle: z.string().describe('A new, clearer, more actionable title for the task.'),
  reminderDateTime: z.string().nullable().describe('The extracted reminder date and time in ISO 8601 format (e.g., 2024-08-20T14:00:00.000Z), or null if none is found.'),
});
export type FormatNoteForNotionOutput = z.infer<typeof FormatNoteForNotionOutputSchema>;

export async function formatNoteForNotion(input: FormatNoteForNotionInput): Promise<FormatNoteForNotionOutput> {
  return formatNoteForNotionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'formatNoteForNotionPrompt',
  input: {schema: FormatNoteForNotionInputSchema},
  output: {schema: FormatNoteForNotionOutputSchema},
  prompt: `You are an intelligent assistant that helps format tasks for Notion.
  Your goal is to refine a task and extract a specific reminder date and time from its details.

  Current Date for reference: ${new Date().toISOString()}

  Task Details:
  Title: {{{title}}}
  Subtasks:
  {{#each subtasks}}
  - {{{this}}}
  {{/each}}

  Instructions:
  1.  **Refine the Title**: Based on the title and subtasks, create a clearer, more actionable title. For example, if the title is "meeting" and a subtask is "discuss budget", a good title would be "Meeting to Discuss Budget".
  2.  **Extract Reminder Date & Time**: Analyze the title and subtasks for any mention of a date or time (e.g., "tomorrow at 3pm", "August 25th", "next Friday"). Convert this into a precise ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). 
  
  IMPORTANT: When a time is mentioned (e.g., "3pm"), assume it is in the user's local time. Do NOT convert it to UTC. For example, if a user says '3pm', the time portion of the ISO string should be 'T15:00:00'. If no specific date or time is mentioned, return null for the reminderDateTime.
  
  Please provide the refined title and the extracted date/time.
  `,
});

const formatNoteForNotionFlow = ai.defineFlow(
  {
    name: 'formatNoteForNotionFlow',
    inputSchema: FormatNoteForNotionInputSchema,
    outputSchema: FormatNoteForNotionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
