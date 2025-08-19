
'use server';

/**
 * @fileOverview An AI agent for creating structured tasks from voice notes.
 *
 * - createTaskFromVoice - A function that transcribes audio and structures it into a task.
 * - CreateTaskFromVoiceInput - The input type for the function.
 * - CreateTaskFrom-VoiceOutput - The return type for the function.
 */

import { genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const CreateTaskFromVoiceInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A recording of the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
   userId: z.string().describe("The user's unique ID."),
   apiKey: z.string().describe("The user's Gemini API key."),
});
export type CreateTaskFromVoiceInput = z.infer<typeof CreateTaskFromVoiceInputSchema>;

const CreateTaskFromVoiceOutputSchema = z.object({
  taskTitle: z.string().describe('A concise title for the task.'),
  subtasks: z.array(z.string()).describe('A list of sub-tasks or to-do items derived from the note.'),
});
export type CreateTaskFromVoiceOutput = z.infer<typeof CreateTaskFromVoiceOutputSchema>;

export async function createTaskFromVoice(input: CreateTaskFromVoiceInput): Promise<CreateTaskFromVoiceOutput> {
  const taskDetails = await createTaskFromVoiceFlow(input);
  return taskDetails;
}

const createTaskFromVoiceFlow = genkit(
  {
    name: 'createTaskFromVoiceFlow',
    inputSchema: CreateTaskFromVoiceInputSchema,
    outputSchema: CreateTaskFromVoiceOutputSchema,
  },
  async (input) => {

    configureGenkit({
      plugins: [googleAI({ apiKey: input.apiKey })],
    });

    const prompt = `You are an expert at taking transcribed audio and converting it into a structured task list.
  
      Your task is to:
      1.  Create a clear and concise title for the overall task.
      2.  Identify the individual action items or sub-tasks from the transcription.
      3.  Format these action items into a simple list of strings.

      Transcribe the following audio and convert it into a task title and a list of subtasks.
      
      Audio: ${input.audioDataUri}`;
    
    const { output } = await genkit.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: prompt,
        output: {
            schema: CreateTaskFromVoiceOutputSchema
        }
    });
    
    return output!;
  }
);
