
'use client';

import { useState, useEffect, useCallback } from 'react';
import { gapi, loadAuth2 } from 'gapi-script';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCOPE = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_SCOPE;

export function useGoogleApi() {
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [googleAuth, setGoogleAuth] = useState<gapi.auth2.GoogleAuth | null>(null);

  useEffect(() => {
    if (!API_KEY || !CLIENT_ID || !SCOPE) {
      console.error('Google API environment variables are not set. Please create a .env.local file and add NEXT_PUBLIC_GOOGLE_API_KEY, NEXT_PUBLIC_GOOGLE_CLIENT_ID, and NEXT_PUBLIC_GOOGLE_CALENDAR_SCOPE');
      return;
    }

    const loadGapi = async () => {
      try {
        const auth2 = await loadAuth2(gapi, CLIENT_ID, SCOPE);
        setGoogleAuth(auth2);
        
        // Also load the calendar client
        gapi.load('client', () => {
          gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            scope: SCOPE,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
          }).then(() => {
            setIsApiLoaded(true);
          }).catch(err => console.error("Error initializing gapi client", err));
        });

      } catch (error) {
        console.error('Error loading Google Auth2:', error);
      }
    };

    loadGapi();
  }, []);

  const signIn = useCallback(async () => {
    if (!googleAuth) {
      throw new Error('Google Auth not initialized.');
    }

    if (!googleAuth.isSignedIn.get()) {
      await googleAuth.signIn();
    }
  }, [googleAuth]);

  const createEvent = useCallback(async (event: gapi.client.calendar.Event) => {
    if (!gapi.client.calendar) {
        throw new Error('Google Calendar API client is not loaded.');
    }
    
    try {
        const request = gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
        });

        const response = await request;

        if (response.status < 200 || response.status >= 300) {
            console.error('Error creating event:', response);
            throw new Error(`Failed to create event. Status: ${response.statusText}`);
        }
        
        return response.result;

    } catch (error) {
        console.error('Error in createEvent function:', error);
        // Re-throw the error so the component can catch it and display a message
        throw error;
    }
  }, []);

  return { isApiLoaded, signIn, createEvent };
}
