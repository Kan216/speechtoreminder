
'use server';

import { google } from 'googleapis';
import { z } from 'zod';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const ScheduleEventInputSchema = z.object({
  userId: z.string(),
  title: z.string(),
  startTime: z.string(),
  eventId: z.string().optional(),
});
type ScheduleEventInput = z.infer<typeof ScheduleEventInputSchema>;

async function getOauth2Client(userId: string) {
    const tokenDocRef = doc(db, 'users', userId, 'private', 'google');
    const tokenSnap = await getDoc(tokenDocRef);

    if (!tokenSnap.exists()) {
        throw new Error("Google token not found for this user. Please re-authenticate.");
    }
    const tokenData = tokenSnap.data();
    
    // Check for both access and refresh tokens. The refresh token is crucial.
    if (!tokenData.accessToken || !tokenData.refreshToken) {
        throw new Error("Missing access or refresh token. Please re-authenticate to grant calendar permissions.");
    }
    
    // IMPORTANT: Make sure these are set in your .env file or environment
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        // This MUST match the redirect URI in your Google Cloud Console for the OAuth Client
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
          ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
          : 'http://localhost:9002' 
    );

    oauth2Client.setCredentials({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
    });
    
    // Test if the token is expired, and refresh if it is.
    const isTokenExpired = oauth2Client.isTokenExpiring();
    if(isTokenExpired) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
        } catch (error: any) {
            console.error('Error refreshing access token:', error);
            throw new Error('Could not refresh access token. Please sign out and sign back in.');
        }
    }

    return oauth2Client;
}


export async function createOrUpdateCalendarEvent(input: ScheduleEventInput): Promise<string> {
    const { userId, title, startTime, eventId } = ScheduleEventInputSchema.parse(input);
    
    try {
        const oauth2Client = await getOauth2Client(userId);
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

        // Handle errors from the Google API specifically
        if (error.response?.data?.error) {
            const googleError = error.response.data.error;
            if (googleError.code === 403 || googleError.code === 401) {
                 if (googleError.message && googleError.message.includes('cannot be used')) {
                     friendlyMessage = "The Google Calendar API is not enabled or is misconfigured. Please enable it in the Google Cloud Console.";
                 } else if (googleError.message) {
                     friendlyMessage = `Google Calendar Permission Error: ${googleError.message}`;
                 } else {
                     friendlyMessage = "Missing or insufficient permissions."
                 }
            } else if (googleError.error === 'invalid_grant') {
                 friendlyMessage = "Your Google authentication is invalid. Please sign out and sign back in to reconnect your calendar.";
            } else {
                friendlyMessage = `Google Calendar Error: ${googleError.message || googleError.error_description}`;
            }
        } else if (error.message) {
             friendlyMessage = error.message;
        }
        
        throw new Error(friendlyMessage);
    }
}
