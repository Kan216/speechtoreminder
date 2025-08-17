
'use server';

/**
 * @fileOverview An AI agent for creating structured tasks from voice notes.
 *
 * - createTaskFromVoice - A function that transcribes audio and structures it into a task.
 * - CreateTaskFromVoiceInput - The input type for the function.
 * - CreateTaskFromVoiceOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { scheduleEvent } from './schedule-event';

const CreateTaskFromVoiceInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'A recording of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
   accessToken: z.string().describe("The user's Google OAuth2 access token.")
});
export type CreateTaskFromVoiceInput = z.infer<typeof CreateTaskFromVoiceInputSchema>;

const CreateTaskFromVoiceOutputSchema = z.object({
  taskTitle: z.string().describe('A concise title for the task.'),
  subtasks: z.array(z.string()).describe('A list of sub-tasks or to-do items derived from the note.'),
  dueDate: z.string().optional().describe('The due date for the task in ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ) if mentioned. If not mentioned, this should be omitted.')
});
export type CreateTaskFromVoiceOutput = z.infer<typeof CreateTaskFromVoiceOutputSchema>;

export async function createTaskFromVoice(input: CreateTaskFromVoiceInput): Promise<CreateTaskFromVoiceOutput & { calendarEventId?: string }> {
  const taskDetails = await createTaskFromVoiceFlow(input);

  if (taskDetails.dueDate) {
    try {
      const eventId = await scheduleEvent({
        accessToken: input.accessToken,
        title: taskDetails.taskTitle,
        startTime: taskDetails.dueDate,
      });
      return { ...taskDetails, calendarEventId: eventId };
    } catch(e) {
        console.error("Failed to schedule event", e);
        // Do not block task creation if calendar event fails
        return taskDetails;
    }
  }

  return taskDetails;
}

const prompt = ai.definePrompt({
  name: 'createTaskFromVoicePrompt',
  input: {schema: z.object({ audioDataUri: z.string() }) },
  output: {schema: CreateTaskFromVoiceOutputSchema},
  prompt: `You are an expert at taking transcribed audio and converting it into a structured task list.
  
  Your task is to:
  1.  Create a clear and concise title for the overall task.
  2.  Identify the individual action items or sub-tasks from the transcription.
  3.  Format these action items into a simple list of strings.
  4.  If a date or time is mentioned (e.g., "tomorrow at 3pm", "next Friday", "on June 1st"), determine the exact date and time and provide it in the 'dueDate' field in strict ISO 8601 format. The current date is ${new Date().toISOString()}.

  Transcribe the following audio and convert it into a task title, a list of subtasks, and an optional due date.
  
  Audio: {{media url=audioDataUri}}`,
});

const createTaskFromVoiceFlow = ai.defineFlow(
  {
    name: 'createTaskFromVoiceFlow',
    inputSchema: CreateTaskFromVoiceInputSchema,
    outputSchema: CreateTaskFromVoiceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt({ audioDataUri: input.audioDataUri });
    return output!;
  }
);
