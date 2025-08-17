
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

async function getOauth2Client(userId: string) {
    const tokenDocRef = doc(db, 'users', userId, 'private', 'google');
    const tokenDoc = await getDoc(tokenDocRef);

    if (!tokenDoc.exists()) {
        throw new Error('User has not granted Google Calendar permissions. Please sign in again.');
    }

    const tokens = tokenDoc.data();
    if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Access or Refresh token not found. Please sign in again to grant permissions.');
    }

    const oauth2Client = new google.auth.OAuth2(
        // These can be left undefined as we are not using them for server-to-server flow here
        undefined, 
        undefined,
        // The redirect URL is also not needed for refreshing tokens
        undefined 
    );
    
    oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
    });
    
    // The googleapis library automatically handles token refreshing
    // if the refresh_token is provided.

    return oauth2Client;
}


export async function createOrUpdateCalendarEvent(input: ScheduleEventInput): Promise<string> {
    const { userId, title, startTime, eventId } = ScheduleEventInputSchema.parse(input);
    
    const oauth2Client = await getOauth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Default to a 1-hour event duration
    const eventEndTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

    const event = {
      summary: title,
      start: {
        dateTime: startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use user's local timezone
      },
      end: {
        dateTime: eventEndTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        console.error('Error interacting with Google Calendar:', error.message);
        
        let friendlyMessage = `Failed to create or update calendar event: ${error.message}`;

        if (error.code === 401) {
            friendlyMessage = "Your Google credentials have expired. Please sign out and sign back in to reconnect your calendar.";
        } else if (error.code === 403) {
             if (error.message?.includes('forbidden')) {
                 friendlyMessage = "The Google Calendar API is not enabled for your project. Please enable it in the Google Cloud Console.";
            } else {
                friendlyMessage = "You don't have permission to access this calendar. Please check your Google Calendar sharing settings.";
            }
        } else if (error.code === 404) {
            friendlyMessage = "The calendar or event was not found. It may have been deleted.";
        }
        
        throw new Error(friendlyMessage);
    }
}
