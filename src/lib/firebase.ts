'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(config as Record<string, string>);
  return app;
}

export function getDb(): Firestore {
  if (db) return db;
  const a = ensureApp();
  try {
    // Offline cache keeps the app usable on a flaky mobile connection and keeps
    // multiple open tabs consistent with each other.
    db = initializeFirestore(a, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(a);
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(ensureApp());
  return auth;
}

/**
 * There is no login screen. We still sign in anonymously so Firestore rules can
 * require an authenticated principal and record workspace membership per device.
 */
export function ensureAnonymousUser(): Promise<string> {
  const a = getFirebaseAuth();
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      a,
      (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
          return;
        }
        signInAnonymously(a).catch((err) => {
          unsub();
          reject(err);
        });
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}
