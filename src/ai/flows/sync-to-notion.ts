
'use server';
/**
 * @fileOverview A Genkit flow for syncing a task to a Notion database.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';

const SyncToNotionInputSchema = z.object({
  notionApiKey: z.string().describe('The user\'s Notion API key.'),
  notionDatabaseId: z.string().describe('The ID of the Notion database to sync to.'),
  taskTitle: z.string().describe('The title of the task.'),
  subtasks: z.array(z.object({
      id: z.string(),
      text: z.string(),
      completed: z.boolean(),
  })).optional().describe('A list of sub-tasks.'),
  status: z.string().describe('The current status of the task (e.g., pending, inprogress, finished).'),
  dueDate: z.string().optional().describe('The optional due date of the task in ISO format.'),
});

const SyncToNotionOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  pageUrl: z.string().optional(),
});

export async function syncToNotion(input: z.infer<typeof SyncToNotionInputSchema>): Promise<z.infer<typeof SyncToNotionOutputSchema>> {
  return syncToNotionFlow(input);
}

const syncToNotionFlow = ai.defineFlow(
  {
    name: 'syncToNotionFlow',
    inputSchema: SyncToNotionInputSchema,
    outputSchema: SyncToNotionOutputSchema,
  },
  async (input) => {
    try {
      const notion = new Client({ auth: input.notionApiKey });
      const databaseId = input.notionDatabaseId;

      // Verify database exists and integration has access
      try {
        await notion.databases.retrieve({ database_id: databaseId });
      } catch (e: any) {
        console.error("Notion API Error - Could not retrieve database:", e.body);
        if (e.code === 'object_not_found') {
             return { success: false, error: 'Could not find a Notion database with the provided ID. Please double-check the Database ID in Settings and make sure the integration has been shared with that database.' };
        }
        if (e.code === 'unauthorized') {
            return { success: false, error: 'Notion API Key is invalid or does not have permission. Please check your API Key in Settings.' };
        }
        return { success: false, error: 'An unexpected error occurred while accessing your Notion database. Please check your console for details.' };
      }

      const contentBlocks = input.subtasks?.map(subtask => ({
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [{ type: 'text' as const, text: { content: subtask.text } }],
          checked: subtask.completed,
        },
      }));

      const pageParams: CreatePageParameters = {
        parent: { database_id: databaseId },
        properties: {
          Name: { // Assumes a 'Name' property of type 'title' in the database
            title: [
              {
                text: {
                  content: input.taskTitle,
                },
              },
            ],
          },
          Status: { // Assumes a 'Status' property of type 'select'
            select: {
              name: input.status,
            },
          },
          ...(input.dueDate && {
              'Due Date': { // Assumes a 'Due Date' property of type 'date'
                  date: {
                      start: new Date(input.dueDate).toISOString(),
                  }
              }
          })
        },
        ...(contentBlocks && { children: contentBlocks }),
      };

      const response = await notion.pages.create(pageParams);

      return {
        success: true,
        pageUrl: (response as any).url, // Type assertion to access url
      };

    } catch (error: any) {
        console.error('Full Notion Sync Error:', JSON.stringify(error, null, 2));
        const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
        
        let userFriendlyError = `Failed to create Notion page. Notion says: "${errorMessage}"`;
        if (errorMessage.includes("property")) {
            userFriendlyError += ' Please ensure your database has columns named "Name", "Status", and "Due Date" with the correct property types (Title, Select, and Date).'
        }

        return { 
            success: false, 
            error: userFriendlyError 
        };
    }
  }
);
