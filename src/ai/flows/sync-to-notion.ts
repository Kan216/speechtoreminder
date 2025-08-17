
'use server';

/**
 * @fileOverview A robust AI flow for synchronizing a task with Notion.
 * This flow now expects credentials to be passed in directly and provides
 * detailed, specific error messages to the client for easier debugging.
 *
 * - syncToNotion - The function to call to sync a task.
 * - SyncToNotionInput - The input type for the function.
 * - SyncToNotionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, APIResponseError } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import type { Note } from '@/hooks/use-auth';

const SyncToNotionInputSchema = z.object({
  note: z.any().describe('The task object to be synced.'),
  notionApiKey: z.string().describe('The user\'s Notion API key.'),
  notionDatabaseId: z.string().describe('The ID of the Notion database to sync to.'),
});
export type SyncToNotionInput = z.infer<typeof SyncToNotionInputSchema>;

const SyncToNotionOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  pageUrl: z.string().optional(),
});
export type SyncToNotionOutput = z.infer<typeof SyncToNotionOutputSchema>;

// This is the main function that the client-side code will call.
export async function syncToNotion(input: SyncToNotionInput): Promise<SyncToNotionOutput> {
  return syncToNotionFlow(input);
}

// Define the Genkit flow
const syncToNotionFlow = ai.defineFlow(
  {
    name: 'syncToNotionFlow',
    inputSchema: SyncToNotionInputSchema,
    outputSchema: SyncToNotionOutputSchema,
  },
  async (input: SyncToNotionInput): Promise<SyncToNotionOutput> => {
    const { note, notionApiKey, notionDatabaseId } = input;

    try {
      const notion = new Client({ auth: notionApiKey });

      // 1. Verify the database exists and has the required properties
      try {
        const db = await notion.databases.retrieve({ database_id: notionDatabaseId });
        const props = db.properties;
        if (!props['Name'] || props['Name'].type !== 'title') {
            return { success: false, error: "Your Notion database must have a 'Name' property of type 'Title'." };
        }
        if (!props['Status'] || props['Status'].type !== 'select') {
            return { success: false, error: "Your Notion database must have a 'Status' property of type 'Select'." };
        }
        if (!props['Due Date'] || props['Due Date'].type !== 'date') {
            return { success: false, error: "Your Notion database must have a 'Due Date' property of type 'Date'." };
        }
      } catch (e) {
          // Re-throw to be caught by the outer catch block
          throw e;
      }
      
      // 2. Construct the page to be created in Notion
      const pageProperties: CreatePageParameters['properties'] = {
        'Name': {
          type: 'title',
          title: [
            {
              type: 'text',
              text: { content: note.title },
            },
          ],
        },
        'Status': {
          type: 'select',
          select: { name: note.status || 'pending' },
        },
      };

      if (note.dueDate) {
        pageProperties['Due Date'] = {
          type: 'date',
          date: { start: new Date(note.dueDate).toISOString() },
        };
      }

      const pageChildren = note.subtasks?.map((subtask: any) => ({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{ type: 'text', text: { content: subtask.text } }],
          checked: subtask.completed,
        },
      }));
      
      // 3. Create the page in Notion
      const response = await notion.pages.create({
        parent: { database_id: notionDatabaseId },
        properties: pageProperties,
        children: pageChildren,
      });

      return { success: true, pageUrl: response.url };

    } catch (error: unknown) {
      console.error('Detailed Notion API Error:', JSON.stringify(error, null, 2));

      if (error instanceof APIResponseError) {
        switch (error.code) {
          case 'unauthorized':
            return { success: false, error: 'Authentication failed. Please check your Notion API Key.' };
          case 'object_not_found':
            return { success: false, error: 'The Notion database was not found. Please verify the Database ID and ensure the integration is shared with the database.' };
          case 'validation_error':
            return { success: false, error: `Notion reported a validation error: ${error.message}. This could be due to missing or misconfigured database properties.` };
          default:
            return { success: false, error: `A Notion API error occurred: ${error.message}` };
        }
      }

      // Fallback for non-Notion API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `An unexpected error occurred: ${errorMessage}`,
      };
    }
  }
);
