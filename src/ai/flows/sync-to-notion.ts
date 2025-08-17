
'use server';

/**
 * @fileOverview A flow to sync a task and its subtasks to a user's Notion database.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const SyncToNotionInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  subtasks: z.array(z.object({
    text: z.string(),
    completed: z.boolean(),
  })).describe('A list of subtasks.'),
  userId: z.string().describe("The user's unique ID."),
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
    
    // Get user-specific Notion credentials from Firestore
    let notionApiKey: string | undefined;
    let notionDatabaseId: string | undefined;

    try {
        const userRef = doc(db, 'users', input.userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            notionApiKey = userData.notionApiKey;
            notionDatabaseId = userData.notionDatabaseId;
        } else {
            return { success: false, error: 'User profile not found.' };
        }
    } catch(err: any) {
        return { success: false, error: 'Failed to retrieve user credentials from Firestore.' };
    }


    if (!notionApiKey) {
      return { success: false, error: 'Notion API Key is not configured for this user.' };
    }
    if (!notionDatabaseId) {
        return { success: false, error: 'Notion Database ID is not configured for this user.' };
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
        let errorMessage = 'Failed to create Notion page.';
        if (errorData.message) {
            errorMessage += ` Notion says: "${errorData.message}"`;
        }
        throw new Error(errorMessage);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
);
