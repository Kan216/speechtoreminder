
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { collection, query, orderBy, onSnapshot, Timestamp, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id:string;
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
            const docSnap = await getDoc(userRef);
            const userProfileData = {
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                lastLogin: serverTimestamp()
            };
            if (!docSnap.exists()) {
                await setDoc(userRef, {
                    ...userProfileData,
                    createdAt: serverTimestamp()
                });
            } else {
                await updateDoc(userRef, userProfileData);
            }
        } catch (error: any) {
            console.error("Firestore Error: Could not create or update user profile.", error);
            if (error.code === 'permission-denied') {
                setNotesError("Permission Error: Could not save your user profile. Please update Firestore security rules.");
            }
        }

        setUser(user);

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
              setNotesError("Permission Denied: Please check your Firestore security rules to allow listing notes.");
          } else {
              setNotesError(error.message);
          }
          setNotesLoading(false);
        });
        
        setLoading(false);
        return () => unsubscribeNotes();
      } else {
        setUser(null);
        setLoading(false);
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
