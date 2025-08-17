
'use server';

/**
 * @fileOverview A flow for creating and updating Google Calendar events.
 *
 * - scheduleEvent - Creates or updates a Google Calendar event.
 * - ScheduleEventInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createOrUpdateCalendarEvent } from '@/lib/actions/calendar';

const ScheduleEventInputSchema = z.object({
  accessToken: z.string().describe("The user's Google OAuth2 access token."),
  title: z.string().describe('The title of the calendar event.'),
  startTime: z.string().describe('The start time for the event in ISO 8601 format.'),
  eventId: z.string().optional().describe('The existing event ID if this is an update.'),
});
export type ScheduleEventInput = z.infer<typeof ScheduleEventInputSchema>;


export const scheduleEvent = ai.defineFlow(
  {
    name: 'scheduleEventFlow',
    inputSchema: ScheduleEventInputSchema,
    outputSchema: z.string().describe("The ID of the created or updated calendar event."),
  },
  async (input) => {
    return createOrUpdateCalendarEvent(input);
  }
);
