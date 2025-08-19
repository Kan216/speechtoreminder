
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { formatNoteForNotion } from '@/ai/flows/format-note-for-notion';

function extractDatabaseId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    // Check if it's a valid UUID (32 hex characters, possibly with dashes)
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    const strippedId = urlOrId.replace(/-/g, '');
    if (strippedId.length === 32 && /^[0-9a-f]+$/i.test(strippedId)) {
        // It's already a valid ID or a UUID with dashes
        return urlOrId.replace(/-/g, '');
    }

    // Otherwise, try to extract it from a URL
    try {
        const url = new URL(urlOrId);
        const pathParts = url.pathname.split('/');
        const idPart = pathParts.find(part => part.length === 32 && /^[0-9a-f]+$/i.test(part));
        if (idPart) {
            return idPart;
        }
        // Look for ID in the last part of the path, removing query params
        const lastPart = pathParts[pathParts.length - 1];
        const idFromLastPart = lastPart.split('?')[0];
         if (idFromLastPart.length === 32 && /^[0-9a-f]+$/i.test(idFromLastPart)) {
            return idFromLastPart;
        }

    } catch (e) {
        // Not a valid URL, but we already checked if it's an ID
    }

    return null; // Return null if no valid ID could be found
}


export async function POST(req: NextRequest) {
    const { note, notionDatabaseId: rawNotionDatabaseId, notionApiKey, geminiApiKey } = await req.json();

    if (!notionApiKey) {
        return NextResponse.json({ success: false, error: 'The Notion API Key is not configured. Please set it in Settings.' }, { status: 500 });
    }
     if (!geminiApiKey) {
        return NextResponse.json({ success: false, error: 'The Gemini API Key is not configured. Please set it in Settings.' }, { status: 500 });
    }
    if (!rawNotionDatabaseId) {
        return NextResponse.json({ success: false, error: 'The Notion Database ID is not configured. Please set it in Settings.' }, { status: 500 });
    }
    if (!note) {
        return NextResponse.json({ success: false, error: 'Missing note data.' }, { status: 400 });
    }

    const notionDatabaseId = extractDatabaseId(rawNotionDatabaseId);

    if (!notionDatabaseId) {
        return NextResponse.json({ success: false, error: `Invalid Notion Database ID format. Please provide the 32-character ID or the full Notion URL.` }, { status: 400 });
    }

    try {
        const { formattedTitle, reminderDate, reminderTime } = await formatNoteForNotion({
            title: note.title,
            subtasks: note.subtasks.map((s: any) => s.text),
            apiKey: geminiApiKey,
        });

        const effectiveTitle = formattedTitle || note.title || 'Untitled Task';
        
        let effectiveDueDate = null;
        if (reminderDate) {
            if (reminderTime) {
                // If we have date and time, combine them into a timezone-free ISO string
                effectiveDueDate = `${reminderDate}T${reminderTime}:00`;
            } else {
                // If we only have a date, use that
                effectiveDueDate = reminderDate;
            }
        } else if (note.dueDate) {
             effectiveDueDate = new Date(note.dueDate).toISOString().split('T')[0];
        }


        const pageProperties: any = {
            'Name': {
                title: [
                    {
                        text: { content: effectiveTitle },
                    },
                ],
            },
            'Status': {
                status: { name: note.status || 'pending' },
            },
        };

        if (effectiveDueDate) {
             pageProperties['Due Date'] = {
                date: { 
                    start: effectiveDueDate,
                },
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
