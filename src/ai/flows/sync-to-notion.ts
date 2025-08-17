
'use server';

/**
 * @fileOverview A robust AI flow for synchronizing a task with Notion.
 * This flow now delegates the actual Notion API call to a dedicated service,
 * improving separation of concerns and robustness.
 *
 * - syncToNotion - The function to call to sync a task.
 * - SyncToNotionInput - The input type for the function.
 * - SyncToNotionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createNotionPage } from '@/services/notion-service';
import { APIResponseError } from '@notionhq/client';

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
    try {
      if (!input.notionDatabaseId) {
        return { success: false, error: 'The Notion Database ID is missing.' };
      }

      const pageUrl = await createNotionPage(input.note, input.notionDatabaseId);
      return { success: true, pageUrl };

    } catch (error: unknown) {
      console.error('Detailed Notion Sync Error in Flow:', JSON.stringify(error, null, 2));

      if (error instanceof APIResponseError) {
        switch (error.code) {
          case 'unauthorized':
            return { success: false, error: 'Authentication failed. Please check your Notion API Key in the server environment.' };
          case 'object_not_found':
            return { success: false, error: 'The Notion database was not found. Please verify the Database ID and that the integration is shared with the database.' };
          case 'validation_error':
            return { success: false, error: `Notion reported a validation error: ${error.message}. This could be due to missing or misconfigured database properties (e.g., Name, Status, Due Date).` };
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
