
'use server';

import { google } from 'googleapis';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { z } from 'zod';

const ScheduleEventInputSchema = z.object({
  userId: z.string(),
  title: z.string(),
  startTime: z.string(),
  eventId: z.string().optional(),
});
type ScheduleEventInput = z.infer<typeof ScheduleEventInputSchema>;

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

export async function createOrUpdateCalendarEvent(input: ScheduleEventInput): Promise<string> {
    const { userId, title, startTime, eventId } = ScheduleEventInputSchema.parse(input);
    
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

    try {
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
    } catch (error: any) {
        console.error('Error interacting with Google Calendar:', error);

        if (error.code === 401) {
             throw new Error("Google API access token is expired or invalid. Please sign in again.");
        }
        
        if (error.code === 403) {
            if (error.message?.includes('usageLimits')) {
                 throw new Error("Google Calendar API usage limit exceeded. Please try again later.");
            }
            if (error.message?.includes('forbidden')) {
                 throw new Error("The Google Calendar API is not enabled for your project. Please enable it in the Google Cloud Console.");
            }
        }
        
        throw new Error(`Failed to create or update calendar event: ${error.message}`);
    }
}
