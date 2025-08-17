
'use client';

import { useEffect, useState, useRef } from 'react';
import { Note } from './use-auth';
import { useToast } from './use-toast';

export function useNotifications(notes: Note[]) {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const notifiedTaskIds = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermission('granted');
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(setPermission);
      } else {
        setPermission('denied');
      }
    }
  }, []);

  useEffect(() => {
    if (permission !== 'granted') {
      return;
    }

    const checkNotifications = () => {
      const now = new Date();
      notes.forEach(note => {
        if (note.dueDate && !notifiedTaskIds.current.has(note.id) && note.status !== 'finished') {
          const dueDate = new Date(note.dueDate);
          const timeDiff = dueDate.getTime() - now.getTime();
          
          if (timeDiff > 0 && timeDiff <= 60000) { // 1 minute window
            const notification = new Notification('Upcoming Task Reminder', {
              body: `Your task "${note.title}" is due now.`,
              icon: '/logo.png', // Make sure you have a logo.png in your /public folder
              data: { url: `/notes/${note.id}` },
            });

            notification.onclick = (event) => {
              event.preventDefault(); 
              const targetUrl = (event.target as Notification).data.url;
              window.open(targetUrl, '_blank');
            };

            notifiedTaskIds.current.add(note.id);
          }
        }
      });
    };

    const intervalId = setInterval(checkNotifications, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [permission, notes]);

  useEffect(() => {
    // This effect will run once on mount to show a toast if notifications are denied.
    if (permission === 'denied') {
        toast({
            title: "Notifications Blocked",
            description: "You have blocked notifications. To get task reminders, please enable them in your browser settings.",
            variant: "destructive"
        })
    }
  }, [permission, toast])
}
