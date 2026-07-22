/* ============================================================
   MaDube Books - general API function
   ------------------------------------------------------------
   Handles /api/** requests that are not the admin-auth routes
   (those go to the adminAuth function in functions-admin/).
   Right now it exposes a health check; add real endpoints here
   as the store grows (e.g. payment webhooks, order emails).
   ============================================================ */

const { onRequest } = require("firebase-functions/v2/https");

exports.api = onRequest({ region: "us-central1", cors: true }, (req, res) => {
  const path = (req.path || "").replace(/^\/api/, "") || "/";

  if (path === "/" || path === "/health") {
    res.json({ ok: true, service: "madube-api", time: new Date().toISOString() });
    return;
  }

  res.status(404).json({ ok: false, error: "Not found: " + path });
});
