/* ============================================================
   MaDube Books - admin login OTP (adminAuth function)
   ------------------------------------------------------------
   Two routes, both handled by the exported `adminAuth` function
   (see the rewrites in firebase.json):

     POST /api/send-admin-code    -> emails a fresh 6-digit code
     POST /api/verify-admin-code  -> checks the submitted code

   Both require a valid Firebase ID token (the admin has already
   passed email + password); OTP is the second factor. Codes are
   stored hashed in Firestore (admin_otp/{uid}) with a 10-minute
   expiry and an attempt limit.

   Email is sent through Resend (https://resend.com).

   CONFIG (set before deploy):
     firebase functions:secrets:set RESEND_API_KEY
     functions-admin/.env  ->  FROM_EMAIL, ADMIN_EMAILS (optional
                               comma-separated allowlist)
   FROM_EMAIL must be an address on a domain you have verified in
   Resend. For quick testing you can use Resend's shared sender
   "onboarding@resend.dev", which only delivers to the email you
   signed up to Resend with.
   ============================================================ */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/* ---------- helpers ---------- */
function json(res, status, body) {
  res.set("Cache-Control", "no-store");
  res.status(status).json(body);
}

function hashCode(code, salt) {
  return crypto.createHmac("sha256", salt).update(String(code)).digest("hex");
}

function maskEmail(email) {
  const parts = String(email).split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const shown = name.length <= 2 ? name[0] : name.slice(0, 2);
  return shown + "***@" + parts[1];
}

function allowlist() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return { error: "Missing sign-in token." };
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (e) {
    return { error: "Your session expired. Please sign in again." };
  }
  const email = (decoded.email || "").toLowerCase();
  const list = allowlist();
  if (list.length && list.indexOf(email) === -1) {
    return { error: "This account is not permitted to sign in." };
  }
  return { uid: decoded.uid, email: decoded.email };
}

async function sendEmail(to, subject, text, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY.value(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "MaDube Books <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      text: text,
      html: html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(function () { return ""; });
    throw new Error("Resend " + res.status + ": " + detail);
  }
}

/* ---------- route handlers ---------- */
async function sendCode(req, res) {
  const auth = await requireAdmin(req);
  if (auth.error) return json(res, 401, { ok: false, error: auth.error });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const salt = crypto.randomBytes(16).toString("hex");

  await admin.firestore().collection("admin_otp").doc(auth.uid).set({
    hash: hashCode(code, salt),
    salt: salt,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await sendEmail(
      auth.email,
      "Your MaDube Books admin code",
      "Your admin verification code is " + code + ".\n\n" +
        "It expires in 10 minutes. If you did not try to sign in, ignore this email.",
      '<p>Your MaDube Books admin verification code is:</p>' +
        '<p style="font-size:26px;font-weight:700;letter-spacing:4px;">' + code + "</p>" +
        "<p>It expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>"
    );
  } catch (e) {
    console.error("[adminAuth] email send failed:", e);
    return json(res, 500, { ok: false, error: "Could not send the code. Check email settings." });
  }

  return json(res, 200, { ok: true, email: maskEmail(auth.email) });
}

async function verifyCode(req, res) {
  const auth = await requireAdmin(req);
  if (auth.error) return json(res, 401, { verified: false, error: auth.error });

  const submitted = String((req.body && req.body.code) || "").trim();
  if (!/^\d{6}$/.test(submitted)) {
    return json(res, 400, { verified: false, error: "Enter the 6-digit code." });
  }

  const ref = admin.firestore().collection("admin_otp").doc(auth.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return json(res, 400, { verified: false, error: "No code found. Please request a new one." });
  }

  const data = snap.data();
  if (Date.now() > data.expiresAt) {
    await ref.delete();
    return json(res, 400, { verified: false, error: "That code expired. Please request a new one." });
  }
  if ((data.attempts || 0) >= MAX_ATTEMPTS) {
    await ref.delete();
    return json(res, 429, { verified: false, error: "Too many attempts. Please request a new code." });
  }

  if (hashCode(submitted, data.salt) !== data.hash) {
    await ref.update({ attempts: (data.attempts || 0) + 1 });
    return json(res, 400, { verified: false, error: "Incorrect code. Please try again." });
  }

  await ref.delete();
  return json(res, 200, { verified: true });
}

/* ---------- entry point ---------- */
exports.adminAuth = onRequest(
  { region: "us-central1", cors: true, secrets: [RESEND_API_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed." });
    }
    const path = req.path || "";
    try {
      if (path.endsWith("/send-admin-code")) return await sendCode(req, res);
      if (path.endsWith("/verify-admin-code")) return await verifyCode(req, res);
      return json(res, 404, { ok: false, error: "Unknown route." });
    } catch (e) {
      console.error("[adminAuth] error:", e);
      return json(res, 500, { ok: false, error: "Something went wrong. Please try again." });
    }
  }
);
