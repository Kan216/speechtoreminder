
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
  dueDate?: string;
}

export interface UserProfile {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    notionApiKey?: string;
    notionDatabaseId?: string;
}

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  notes: Note[];
  notesLoading: boolean;
  notesError: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  notes: [],
  notesLoading: true,
  notesError: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      
      if (user) {
        setUser(user);
        
        // Listen for user profile changes
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
            } else {
                 // Create profile if it doesn't exist
                const newUserProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                };
                setDoc(userRef, { ...newUserProfile, createdAt: serverTimestamp() });
            }
        });

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

        return () => {
            unsubscribeProfile();
            unsubscribeNotes();
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setNotes([]);
        setNotesLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, notes, notesLoading, notesError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
