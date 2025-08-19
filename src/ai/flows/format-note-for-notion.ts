
'use server';

/**
 * @fileOverview An AI agent for formatting a note for Notion.
 *
 * - formatNoteForNotion - A function that refines a task's title and extracts a reminder date/time.
 * - FormatNoteForNotionInput - The input type for the function.
 * - FormatNoteForNotionOutput - The return type for the function.
 */

import { genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const FormatNoteForNotionInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  subtasks: z.array(z.string()).describe('A list of sub-tasks or to-do items.'),
  apiKey: z.string().describe("The user's Gemini API key."),
});
export type FormatNoteForNotionInput = z.infer<typeof FormatNoteForNotionInputSchema>;

const FormatNoteForNotionOutputSchema = z.object({
  formattedTitle: z.string().describe('A new, clearer, more actionable title for the task.'),
  reminderDate: z.string().nullable().describe("The extracted reminder date in 'YYYY-MM-DD' format, or null if not found."),
  reminderTime: z.string().nullable().describe("The extracted reminder time in 24-hour 'HH:mm' format, or null if not found."),
});
export type FormatNoteForNotionOutput = z.infer<typeof FormatNoteForNotionOutputSchema>;

export async function formatNoteForNotion(input: FormatNoteForNotionInput): Promise<FormatNoteForNotionOutput> {
  return formatNoteForNotionFlow(input);
}

const formatNoteForNotionFlow = genkit(
  {
    name: 'formatNoteForNotionFlow',
    inputSchema: FormatNoteForNotionInputSchema,
    outputSchema: FormatNoteForNotionOutputSchema,
  },
  async (input) => {
    configureGenkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });

    const prompt = `You are an intelligent assistant that helps format tasks for Notion.
    Your goal is to refine a task and extract a specific reminder date and time from its details.

    Current Date for reference: ${new Date().toISOString().split('T')[0]}

    Task Details:
    Title: ${input.title}
    Subtasks:
    ${input.subtasks.map(s => `- ${s}`).join('\n')}

    Instructions:
    1.  **Refine the Title**: Based on the title and subtasks, create a clearer, more actionable title. For example, if the title is "meeting" and a subtask is "discuss budget", a good title would be "Meeting to Discuss Budget".
    2.  **Extract Date**: Analyze the title and subtasks for any mention of a date (e.g., "tomorrow", "August 25th", "next Friday"). Convert this into a precise 'YYYY-MM-DD' format.
    3.  **Extract Time**: Analyze the title and subtasks for any mention of a time (e.g., "3pm", "14:00"). Convert this into a 24-hour 'HH:mm' format.
    
    IMPORTANT: The time should be extracted as is, without any timezone conversion. If a user says "3pm", the output for reminderTime should be "15:00".

    If no specific date or time is mentioned, return null for the respective fields.
    `;
    
    const { output } = await genkit.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt,
        output: {
            schema: FormatNoteForNotionOutputSchema
        }
    });

    return output!;
  }
);
