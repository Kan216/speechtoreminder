
'use server';

import { google } from 'googleapis';
import { z } from 'zod';

const ScheduleEventInputSchema = z.object({
  accessToken: z.string(),
  title: z.string(),
  startTime: z.string(),
  eventId: z.string().optional(),
});
type ScheduleEventInput = z.infer<typeof ScheduleEventInputSchema>;

async function getOauth2Client(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
        access_token: accessToken,
    });
    return oauth2Client;
}


export async function createOrUpdateCalendarEvent(input: ScheduleEventInput): Promise<string> {
    const { accessToken, title, startTime, eventId } = ScheduleEventInputSchema.parse(input);
    
    try {
        const oauth2Client = await getOauth2Client(accessToken);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const eventEndTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

        const event = {
          summary: title,
          start: {
            dateTime: startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: eventEndTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };

        if (eventId) {
            const res = await calendar.events.update({
                calendarId: 'primary',
                eventId: eventId,
                requestBody: event,
            });
            return res.data.id!;
        } else {
            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });
            return res.data.id!;
        }
    } catch (error: any) {
        console.error('Full Google Calendar API Error:', error);
        
        let friendlyMessage = "An unexpected error occurred while syncing with Google Calendar.";

        if (error.response?.data?.error) {
            const googleError = error.response.data.error;
            if (googleError.code === 403 && (googleError.message.includes('API not enabled') || googleError.message.includes('cannot be used'))) {
                friendlyMessage = "The Google Calendar API is not enabled for this project or is misconfigured. Please enable it in the Google Cloud Console.";
            } else if (googleError.code === 401 || (googleError.code === 400 && googleError.message === 'invalid_grant') ) {
                friendlyMessage = "Your Google authentication has expired or is invalid. Please sign out and sign back in to reconnect your calendar.";
            } else {
                friendlyMessage = `Google Calendar Error: ${googleError.message}`;
            }
        } else if (error.message) {
             friendlyMessage = error.message;
        }
        
        throw new Error(friendlyMessage);
    }
}
