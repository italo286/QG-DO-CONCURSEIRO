
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validação preventiva de configuração
if (!firebaseConfig.apiKey) {
    console.error("ERRO CRÍTICO: VITE_FIREBASE_API_KEY não encontrada no arquivo .env");
}

if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase inicializado com sucesso para o projeto:", firebaseConfig.projectId);
    } catch (error) {
        console.error("Falha ao inicializar Firebase:", error);
    }
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
export { firebase };
