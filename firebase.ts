/**
 * Firebase web configuration for project lemony-89f41, committed here on
 * purpose: these are public identifiers that ship in the bundle anyway; security
 * comes from Auth, not from hiding them.
 *
 * `firebaseConfigured` / a null `auth` (guest-only, Google button hidden) only
 * matter if this config is ever blanked out.
 *
 * `initializeAuth` (never `getAuth`) keeps the cross-origin redirect iframe off
 * the start-up path; `signInWithPopup` passes
 * `browserPopupRedirectResolver` itself. [HARD-WON, game_stack.md §1]
 */
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'


const firebaseConfig = {
  apiKey: "AIzaSyCI-mQ52SfjioEFxuZDoeMbsdGjvlxcTms",
  authDomain: "lemony-89f41.firebaseapp.com",
  projectId: "lemony-89f41",
  storageBucket: "lemony-89f41.firebasestorage.app",
  messagingSenderId: "30100660133",
  appId: "1:30100660133:web:f2b31fcfa8036e69d5d24c"
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const auth: Auth | null = firebaseConfigured
  ? initializeAuth(initializeApp(firebaseConfig), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  : null

export const googleProvider = new GoogleAuthProvider()
