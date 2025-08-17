
'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { note, notionDatabaseId } = await req.json();
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
        return NextResponse.json({ success: false, error: 'The Notion API Key is not configured on the server.' }, { status: 500 });
    }
    if (!note || !notionDatabaseId) {
        return NextResponse.json({ success: false, error: 'Missing note or notionDatabaseId' }, { status: 400 });
    }

    const pageProperties: any = {
        'Name': {
            title: [
                {
                    text: { content: note.title || 'Untitled Task' },
                },
            ],
        },
        'Status': {
            select: { name: note.status || 'pending' },
        },
    };

    if (note.dueDate) {
        pageProperties['Due Date'] = {
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

    try {
        const response = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${notionApiKey}`,
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28"
            },
            body: JSON.stringify({
                parent: { database_id: notionDatabaseId },
                properties: pageProperties,
                children: pageChildren,
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Notion API Error:', data);
            const errorMessage = data.message || 'An unknown error occurred with the Notion API.';
            return NextResponse.json({ success: false, error: errorMessage }, { status: response.status });
        }
        
        return NextResponse.json({ success: true, pageUrl: (data as any).url });

    } catch (error: any) {
        console.error('Failed to sync to Notion:', error);
        return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
