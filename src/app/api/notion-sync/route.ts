'use server';

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';

async function createNotionPage(note: any, notionDatabaseId: string) {
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

    const pageChildren = note.subtasks?.map((subtask: any) => ({
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


export async function POST(req: NextRequest) {
    try {
        const { note, notionDatabaseId } = await req.json();

        if (!note || !notionDatabaseId) {
            return NextResponse.json({ success: false, error: 'Missing note or notionDatabaseId' }, { status: 400 });
        }

        const pageUrl = await createNotionPage(note, notionDatabaseId);

        return NextResponse.json({ success: true, pageUrl });

    } catch (error: any) {
        console.error('Detailed Notion Sync Error in API Route:', JSON.stringify(error, null, 2));

        // Handle Notion-specific errors
        if (error.code) { // Notion errors have a 'code' property
             switch (error.code) {
                case 'unauthorized':
                    return NextResponse.json({ success: false, error: 'Authentication failed. Please check your Notion API Key in the server environment.' }, { status: 401 });
                case 'object_not_found':
                    return NextResponse.json({ success: false, error: 'The Notion database was not found. Please verify the Database ID and that the integration is shared with the database.' }, { status: 404 });
                case 'validation_error':
                    return NextResponse.json({ success: false, error: `Notion reported a validation error: ${error.message}. This could be due to missing or misconfigured database properties (e.g., Name, Status, Due Date).` }, { status: 400 });
                default:
                    return NextResponse.json({ success: false, error: `A Notion API error occurred: ${error.message}` }, { status: 500 });
            }
        }
        
        const errorMessage = error.message || 'An unexpected error occurred.';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
