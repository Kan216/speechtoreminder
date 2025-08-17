
import { Client, APIResponseError } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { Note } from '@/hooks/use-auth';

/**
 * Creates a new page in a Notion database.
 * This function encapsulates all direct interaction with the Notion API.
 *
 * @param note The task object from Firestore.
 * @param notionDatabaseId The ID of the target Notion database.
 * @returns The URL of the newly created Notion page.
 * @throws Will throw an error if the API key is not set or if the Notion API returns an error.
 */
export async function createNotionPage(note: Note, notionDatabaseId: string): Promise<string> {
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
        throw new Error('The Notion API Key is not configured on the server.');
    }

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

    const pageChildren = note.subtasks?.map((subtask) => ({
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
            rich_text: [{ type: 'text' as const, text: { content: subtask.text } }],
            checked: subtask.completed,
        },
    }));

    const response = await notion.pages.create({
        parent: { database_id: notionDatabaseId },
        properties: pageProperties,
        children: pageChildren,
    });

    return (response as any).url;
}
