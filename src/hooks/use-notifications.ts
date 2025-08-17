
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
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(setPermission);
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
          
          // Notify if the task is due within the next minute
          if (timeDiff > 0 && timeDiff <= 60000) {
            new Notification('Upcoming Task Reminder', {
              body: `Your task "${note.title}" is due now.`,
              icon: '/logo.png', // Optional: add a logo in your /public folder
            });
            notifiedTaskIds.current.add(note.id);
          }
        }
      });
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkNotifications, 30000);

    return () => clearInterval(intervalId);
  }, [permission, notes]);

  useEffect(() => {
    if (permission === 'denied') {
        toast({
            title: "Notifications Blocked",
            description: "You have blocked notifications. To get task reminders, please enable them in your browser settings.",
            variant: "destructive"
        })
    }
  }, [permission, toast])
}

