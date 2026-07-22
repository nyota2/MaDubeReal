# MaDube Books - admin + backend setup

The site is now split into:

- `public/` - the website (storefront + `admin.html`), deployed to Firebase Hosting
- `functions/` - general API (`api`), currently a health check
- `functions-admin/` - the admin login OTP backend (`adminAuth`)
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` - security rules

Until the Firebase web config is filled in, everything runs in local (offline)
mode using the browser's storage, so you can test without deploying.

## 1. Add your Firebase web config
Firebase console -> Project settings -> Your apps -> Web app. Copy the values into
`public/js/firebase-config.js` (replace the `PASTE_...` placeholders).

## 2. Enable the services
- Authentication -> Sign-in method -> enable Email/Password, then add your admin
  user under the Users tab.
- Firestore Database -> Create database (Production mode).
- Storage -> Get started (needed for cover/PDF uploads).

## 3. Upgrade to the Blaze plan
Cloud Functions (the OTP login and API) require the Blaze pay-as-you-go plan.
Firebase console -> Upgrade. It still has a generous free tier.

## 4. Configure the OTP email sender (Resend)
1. Create a free account at https://resend.com
2. API Keys -> Create API Key -> copy it (starts with `re_`)
3. Store it as a secret (you paste the key when prompted):

```
firebase functions:secrets:set RESEND_API_KEY
```

4. Set the sender in `functions-admin/.env`. For quick testing keep
   `onboarding@resend.dev` (only delivers to the email you signed up to Resend
   with). For real use, verify your domain in Resend and set `FROM_EMAIL` to an
   address on that domain.

## 5. Install function dependencies
```
cd functions && npm install && cd ..
cd functions-admin && npm install && cd ..
```

## 6. Deploy
```
firebase deploy --only firestore:rules,storage,functions,hosting
```

## How admin login works
Email + password (Firebase Auth) -> a 6-digit code is emailed via the `adminAuth`
function -> enter it to reach the dashboard. "Trust this device" skips the code for
30 days on that browser. If the functions are not deployed yet, login falls back to
email + password only so you are never locked out during setup.

## Data model (Firestore collections)
`books`, `categories`, `announcements`, `orders`, `messages`, plus `admin_otp`
(short-lived login codes, server-only). The storefront reads `books`/`categories`;
checkout writes `orders`; the contact form writes `messages`.
