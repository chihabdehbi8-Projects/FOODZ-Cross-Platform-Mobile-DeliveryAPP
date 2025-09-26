// Import the necessary Firebase modules
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR API KEY",
  authDomain: "YOUR AUTH DOMAIN",
  projectId: "YOUR PROJECTID",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Initialize Firebase app
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();  // Use the existing app if already initialized
}
// Initialize Firebase Authentication, Firestore, and Storage
const auth = getAuth(app);
const db = getFirestore(app);
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const storage = getStorage(app); // Initialize Firebase Storage

// Export Authentication, Firestore database, and Storage
export { auth, db, storage};
export const secondaryAuth = getAuth(secondaryApp);