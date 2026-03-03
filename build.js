const fs = require('fs');

const config = `
/**
 * YourAI — Auto-generated config for Vercel deployment
 */

window.GEMINI_API_KEY = '${process.env.GEMINI_API_KEY || ''}';

// Firebase config
window.FIREBASE_CONFIG = {
  apiKey: '${process.env.FIREBASE_API_KEY || ''}',
  authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
  projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
  storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
  messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
  appId: '${process.env.FIREBASE_APP_ID || ''}',
  measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}'
};
`;

fs.writeFileSync('config.js', config);
console.log('✅ config.js generated successfully based on Environment Variables.');
