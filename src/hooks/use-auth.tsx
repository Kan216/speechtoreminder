'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  created_at: Timestamp;
  subtasks: Subtask[];
  progress: number;
  status: 'pending' | 'inprogress' | 'finished';
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  notes: Note[];
  notesLoading: boolean;
  notesError: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  notes: [],
  notesLoading: true,
  notesError: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        setNotesLoading(true);
        const q = query(
          collection(db, 'users', user.uid, 'notes'),
          orderBy('created_at', 'desc')
        );

        const unsubscribeNotes = onSnapshot(q, (querySnapshot) => {
          const notesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Note[];
          setNotes(notesData);
          setNotesLoading(false);
          setNotesError(null);
        },
        (error) => {
          console.error("Error fetching notes:", error);
          if(error.code === 'permission-denied') {
              setNotesError("Permission Denied: Please check your Firestore security rules.");
          } else {
              setNotesError(error.message);
          }
          setNotesLoading(false);
        });
        
        return () => unsubscribeNotes();
      } else {
        setNotes([]);
        setNotesLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, notes, notesLoading, notesError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
