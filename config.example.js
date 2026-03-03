/**
 * YourAI — Local configuration (secrets)
 *
 * 1. Copy this file to config.js:  copy config.example.js config.js
 * 2. Add your API keys below. config.js is in .gitignore and will not be pushed.
 */

// Get your key: https://aistudio.google.com/app/apikey
window.GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

// Firebase (for Sign in with Google)
// Get config: Firebase Console → Project Settings → General → Your apps
window.FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef'
};
