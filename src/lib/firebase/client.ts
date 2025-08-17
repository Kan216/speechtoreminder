import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAyBZ2Lo5sgteZHzmQIs2t4FtuwvzX5e7g",
    authDomain: "voicenotes-qb2gg.firebaseapp.com",
    projectId: "voicenotes-qb2gg",
    storageBucket: "voicenotes-qb2gg.firebasestorage.app",
    messagingSenderId: "447498844477",
    appId: "1:447498844477:web:df75e4a8c6c009dce8ed54",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
