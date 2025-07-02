import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// TODO: Replace these with your actual Firebase project credentials
// Go to Firebase Console > Project Settings > Your Apps > Web App
const firebaseConfig = {
  apiKey: "AIzaSyAe8xAMnj7adMZ3PNnhWkhg4NCrUtl7MZM", // Replace with your actual API key
  authDomain: "AIzaSyAe8xAMnj7adMZ3PNnhWkhg4NCrUtl7MZMAIzaSyAe8xAMnj7adMZ3PNnhWkhg4NCrUtl7MZMlpg-cylinder-app.firebaseapp.com", // Replace with your actual auth domain
  projectId: "lpg-cylinder-app", // Replace with your actual project ID
  storageBucket: "lpg-cylinder-app.appspot.com", // Replace with your actual storage bucket
  messagingSenderId: "769443593530", // Replace with your actual messaging sender ID
  appId: "1:769443593530:web:415a52b941dcae3e4c6403", // Replace with your actual app ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

export default app; 