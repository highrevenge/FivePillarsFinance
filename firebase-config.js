/*
 * 5-PILLAR FINANCE — Firebase Configuration
 * --------------------------------------------
 * REPLACE the values below with your own project's config, found at:
 * Firebase Console → Project settings → Your apps → (the Web app) → SDK setup and config
 *
 * These values are safe to have in public client-side code — Firebase's
 * actual security comes from your Firestore security rules (see the
 * firestore.rules file / notes I gave you), not from hiding this config.
 */
const firebaseConfig = {
  apiKey: "AIzaSyC5h40kJofO1gBHuOwed_qTc9GWHnOnnGA",
  authDomain: "pillar-finance-8daa2.firebaseapp.com",
  projectId: "pillar-finance-8daa2",
  storageBucket: "pillar-finance-8daa2.firebasestorage.app",
  messagingSenderId: "241695443875",
  appId: "1:241695443875:web:a245c56b5df426c9ad2816"
};

firebase.initializeApp(firebaseConfig);

// Shared handles other scripts (usersLoginSystem.js, systemDashboard.js,
// userDataProfiles.js) use — attached to window so plain <script> includes
// (no bundler/modules) can all see them.
window.auth = firebase.auth();
window.db = firebase.firestore();