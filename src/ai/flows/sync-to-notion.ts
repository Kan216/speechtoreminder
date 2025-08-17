
'use server';

/**
 * @fileOverview A flow to sync a task and its subtasks to a Notion database.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SyncToNotionInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  subtasks: z.array(z.object({
    text: z.string(),
    completed: z.boolean(),
  })).describe('A list of subtasks.'),
});

export type SyncToNotionInput = z.infer<typeof SyncToNotionInputSchema>;

const SyncToNotionOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
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
  async (input) => {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || notionApiKey === 'YOUR_NOTION_API_KEY') {
      return { success: false, error: 'Notion API Key is not configured. Please set NOTION_API_KEY in your .env.local file.' };
    }
    if (!notionDatabaseId || notionDatabaseId === 'YOUR_NOTION_DATABASE_ID') {
        return { success: false, error: 'Notion Database ID is not configured. Please set NOTION_DATABASE_ID in your .env.local file.' };
    }

    try {
      const children = input.subtasks.map(subtask => ({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            type: 'text',
            text: {
              content: subtask.text,
            },
          }],
          checked: subtask.completed,
        },
      }));
      
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: notionDatabaseId },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: input.title,
                  },
                },
              ],
            },
          },
          children: children,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Notion API Error:', errorData);
        throw new Error(errorData.message || 'Failed to create Notion page.');
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
);
