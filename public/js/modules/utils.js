/* ============================================================
   MaDube Books - shared helpers + data-access layer
   ------------------------------------------------------------
   MaDube.DB exposes one async CRUD API used by both the admin
   dashboard and the storefront. It talks to Firestore when the
   Firebase config is filled in, and to localStorage otherwise,
   so the same calling code works in both modes.
   ============================================================ */

window.MaDube = window.MaDube || {};

/* ---------------- small helpers ---------------- */
MaDube.util = {
  uid: function (prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 7);
  },
  escapeHtml: function (s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
  money: function (n) {
    var v = Number(n) || 0;
    return "US$" + v.toFixed(2);
  },
  formatDate: function (value) {
    if (!value) return "";
    var d;
    if (value && typeof value.toDate === "function") d = value.toDate(); // Firestore Timestamp
    else d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  },
  readFileAsDataURL: function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
};

/* ---------------- toast (uses #toastContainer if present) ---------------- */
MaDube.toast = function (msg, type) {
  var host = document.getElementById("toastContainer");
  if (!host) { console.log("[toast]", msg); return; }
  var el = document.createElement("div");
  el.className = "toast toast-" + (type || "info");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(function () { el.classList.add("show"); }, 10);
  setTimeout(function () {
    el.classList.remove("show");
    setTimeout(function () { el.remove(); }, 300);
  }, 3000);
};

/* ============================================================
   MaDube.DB - collection CRUD (Firestore OR localStorage)
   Every method returns a Promise.
   ============================================================ */
(function () {
  var fb = MaDube.firebase || { mode: "local", ready: false };
  var isFire = fb.mode === "firestore" && fb.ready && fb.db;

  /* ---- localStorage backend ---- */
  var local = {
    key: function (name) { return "madube_" + name; },
    all: function (name) {
      try { return JSON.parse(localStorage.getItem(this.key(name)) || "[]"); }
      catch (e) { return []; }
    },
    write: function (name, arr) {
      localStorage.setItem(this.key(name), JSON.stringify(arr));
    },
    list: function (name) { return Promise.resolve(this.all(name)); },
    get: function (name, id) {
      var found = this.all(name).filter(function (x) { return x.id === id; })[0];
      return Promise.resolve(found || null);
    },
    add: function (name, data) {
      var arr = this.all(name);
      var rec = Object.assign({}, data);
      rec.id = rec.id || MaDube.util.uid(name.slice(0, 3));
      rec.createdAt = rec.createdAt || new Date().toISOString();
      arr.push(rec);
      this.write(name, arr);
      return Promise.resolve(rec);
    },
    set: function (name, id, data) {
      var arr = this.all(name);
      var i = arr.findIndex(function (x) { return x.id === id; });
      var rec = Object.assign({}, (i >= 0 ? arr[i] : {}), data, { id: id });
      rec.updatedAt = new Date().toISOString();
      if (i >= 0) arr[i] = rec; else arr.push(rec);
      this.write(name, arr);
      return Promise.resolve(rec);
    },
    remove: function (name, id) {
      var arr = this.all(name).filter(function (x) { return x.id !== id; });
      this.write(name, arr);
      return Promise.resolve(true);
    }
  };

  /* ---- Firestore backend ---- */
  var fire = {
    col: function (name) { return fb.db.collection(name); },
    list: function (name) {
      return this.col(name).get().then(function (snap) {
        return snap.docs.map(function (d) {
          return Object.assign({ id: d.id }, d.data());
        });
      });
    },
    get: function (name, id) {
      return this.col(name).doc(id).get().then(function (doc) {
        return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
      });
    },
    add: function (name, data) {
      var rec = Object.assign({}, data, { createdAt: new Date().toISOString() });
      return this.col(name).add(rec).then(function (ref) {
        return Object.assign({ id: ref.id }, rec);
      });
    },
    set: function (name, id, data) {
      var rec = Object.assign({}, data, { updatedAt: new Date().toISOString() });
      return this.col(name).doc(id).set(rec, { merge: true }).then(function () {
        return Object.assign({ id: id }, rec);
      });
    },
    remove: function (name, id) {
      return this.col(name).doc(id).delete().then(function () { return true; });
    }
  };

  var backend = isFire ? fire : local;

  MaDube.DB = {
    mode: isFire ? "firestore" : "local",
    list: function (name) { return backend.list(name); },
    get: function (name, id) { return backend.get(name, id); },
    add: function (name, data) { return backend.add(name, data); },
    set: function (name, id, data) { return backend.set(name, id, data); },
    remove: function (name, id) { return backend.remove(name, id); }
  };
})();
