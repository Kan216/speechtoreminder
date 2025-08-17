
'use server';

/**
 * @fileOverview A robust AI flow for synchronizing a task with Notion.
 * This flow reads the API key from server environment variables for improved security
 * and provides detailed, specific error messages to the client.
 *
 * - syncToNotion - The function to call to sync a task.
 * - SyncToNotionInput - The input type for the function.
 * - SyncToNotionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, APIResponseError } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';

const SyncToNotionInputSchema = z.object({
  note: z.any().describe('The task object to be synced.'),
  notionDatabaseId: z.string().describe('The ID of the Notion database to sync to.'),
});
export type SyncToNotionInput = z.infer<typeof SyncToNotionInputSchema>;

const SyncToNotionOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  pageUrl: z.string().optional(),
});
export type SyncToNotionOutput = z.infer<typeof SyncToNotionOutputSchema>;


export async function syncToNotion(input: SyncToNotionInput): Promise<SyncToNotionOutput> {
  return syncToNotionFlow(input);
}


const syncToNotionFlow = ai.defineFlow(
  {
    name: 'syncToNotionFlow',
    inputSchema: SyncToNotionInputSchema,
    outputSchema: SyncToNotionOutputSchema,
  },
  async (input: SyncToNotionInput): Promise<SyncToNotionOutput> => {
    const { note, notionDatabaseId } = input;
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
        return { success: false, error: 'The Notion API Key is not configured on the server.' };
    }
    if (!notionDatabaseId) {
        return { success: false, error: 'The Notion Database ID is missing.' };
    }

    try {
      const notion = new Client({ 
          auth: notionApiKey,
      });

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
          date: { start: new Date(note.dueDate).toISOString().split('T')[0] },
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
      
      const response = await notion.pages.create({
        parent: { database_id: notionDatabaseId },
        properties: pageProperties,
        children: pageChildren,
      });

      return { success: true, pageUrl: (response as any).url };

    } catch (error: unknown) {
      console.error('Detailed Notion API Error:', JSON.stringify(error, null, 2));

      if (error instanceof APIResponseError) {
        switch (error.code) {
          case 'unauthorized':
            return { success: false, error: 'Authentication failed. Please check your Notion API Key.' };
          case 'object_not_found':
            return { success: false, error: 'The Notion database was not found. Please verify the Database ID and that the integration is shared with the database.' };
          case 'validation_error':
            return { success: false, error: `Notion reported a validation error: ${error.message}. This could be due to missing or misconfigured database properties (Name, Status, Due Date).` };
          default:
            return { success: false, error: `A Notion API error occurred: ${error.message}` };
        }
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `An unexpected error occurred: ${errorMessage}`,
      };
    }
  }
);
