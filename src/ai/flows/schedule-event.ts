'use server';

/**
 * @fileOverview A flow for creating and updating Google Calendar events.
 *
 * - scheduleEvent - Creates or updates a Google Calendar event.
 * - ScheduleEventInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const ScheduleEventInputSchema = z.object({
  userId: z.string().describe("The user's unique ID."),
  title: z.string().describe('The title of the calendar event.'),
  startTime: z.string().describe('The start time for the event in ISO 8601 format.'),
  eventId: z.string().optional().describe('The existing event ID if this is an update.'),
});
export type ScheduleEventInput = z.infer<typeof ScheduleEventInputSchema>;

async function getAccessToken(userId: string): Promise<string> {
  const tokenDocRef = doc(db, 'users', userId, 'private', 'google');
  const tokenDoc = await getDoc(tokenDocRef);
  if (!tokenDoc.exists()) {
    throw new Error('User has not granted Google Calendar permissions.');
  }
  const data = tokenDoc.data();
  if (!data.accessToken) {
     throw new Error('Access token not found for user.');
  }
  return data.accessToken;
}

export const scheduleEvent = ai.defineFlow(
  {
    name: 'scheduleEventFlow',
    inputSchema: ScheduleEventInputSchema,
    outputSchema: z.string().describe("The ID of the created or updated calendar event."),
  },
  async ({ userId, title, startTime, eventId }) => {
    const accessToken = await getAccessToken(userId);
    
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = {
      summary: title,
      start: {
        dateTime: startTime,
        timeZone: 'America/Los_Angeles', // Consider making this dynamic in a future version
      },
      end: {
        dateTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(), // Default to 1-hour duration
        timeZone: 'America/Los_Angeles',
      },
    };

    if (eventId) {
      // Update existing event
      const res = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
      });
      return res.data.id!;
    } else {
      // Create new event
      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      return res.data.id!;
    }
  }
);
