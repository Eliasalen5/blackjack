// ============================================================
//  Configuración de Firebase
// ============================================================
// 1. Creá un proyecto en https://console.firebase.google.com
// 2. En "Descripción general del proyecto" > "Agregar app" > "Web" (icono </>)
// 3. Copiá el objeto "firebaseConfig" que te muestra y pegálo acá abajo.
// 4. En Firestore Database > "Reglas", seteá estas reglas para poder leer y escribir sin login:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
//
// IMPORTANTE: este archivo NO debe publicarse (contiene claves de acceso).
// Si no cargás la configuración, la app funciona en "modo demo"
// guardando los datos en el navegador (localStorage).
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDA7AbPh2gyK7jYOSBIPkFYQm4d2tm7ppU",
  authDomain: "blackjack-f355b.firebaseapp.com",
  projectId: "blackjack-f355b",
  storageBucket: "blackjack-f355b.firebasestorage.app",
  messagingSenderId: "901661920281",
  appId: "1:901661920281:web:3ed249b63337caf0f3ee88"
};
