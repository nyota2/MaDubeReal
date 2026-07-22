/* ============================================================
   MaDube Books - Firebase configuration + initialisation
   ------------------------------------------------------------
   HOW TO GO LIVE (all visitors see admin changes):
   1. Firebase console -> Project settings -> "Your apps" -> Web app.
      Copy the config object and paste the values below.
   2. Firebase console -> Build -> Authentication -> Sign-in method
      -> enable "Email/Password", then add your admin user
      (Users tab -> Add user).
   3. Firebase console -> Build -> Firestore Database -> Create database
      (Production mode). Then deploy the rules shipped in this repo:
         firebase deploy --only firestore
   4. Reload admin.html and sign in.

   Until step 1 is done the whole site runs in LOCAL mode: the admin
   dashboard and storefront read/write the browser's localStorage so
   you can test everything offline. Nothing is shared between devices
   in local mode - that only starts once the config below is filled in.
   ============================================================ */

window.MaDube = window.MaDube || {};

/* Paste your real Firebase web config values here.
   Leave the placeholders untouched to stay in LOCAL (offline) mode. */
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDcQuYlB9nkTeofgxUydv5gRSL42Rym0Hk",
  authDomain: "madube-bookes.firebaseapp.com",
  projectId: "madube-bookes",
  storageBucket: "madube-bookes.firebasestorage.app",
  messagingSenderId: "824872489092",
  appId: "1:824872489092:web:546b0dab21daa74edaf2d1",
  measurementId: "G-E2701HL9TR"
};

(function () {
  var configured =
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey.indexOf("PASTE_") !== 0 &&
    typeof firebase !== "undefined";

  var fb = { ready: false, mode: "local", app: null, db: null, auth: null, storage: null };

  if (configured) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      fb.app = firebase.app();
      fb.db = firebase.firestore ? firebase.firestore() : null;
      fb.auth = firebase.auth ? firebase.auth() : null;
      fb.storage = firebase.storage ? firebase.storage() : null;
      fb.mode = "firestore";
      fb.ready = true;
    } catch (err) {
      console.warn("[MaDube] Firebase init failed, falling back to local mode:", err);
      fb.mode = "local";
      fb.ready = false;
    }
  } else if (typeof firebase === "undefined" &&
             FIREBASE_CONFIG.apiKey.indexOf("PASTE_") !== 0) {
    console.warn("[MaDube] Firebase SDK not loaded on this page; using local mode.");
  }

  MaDube.firebase = fb;
})();
