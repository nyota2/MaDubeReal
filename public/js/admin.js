/* ============================================================
   MaDube Books - Admin dashboard logic
   ------------------------------------------------------------
   Exposes MaDube.Admin.* (referenced by admin.html) and drives
   every section against MaDube.DB, which is Firestore when the
   Firebase config is filled in and localStorage otherwise.
   ============================================================ */

window.MaDube = window.MaDube || {};

MaDube.Admin = (function () {
  var U = MaDube.util;
  var DB = MaDube.DB;
  var fb = MaDube.firebase || { mode: "local", ready: false };

  var state = {
    section: "dashboard",
    orderFilter: "all",
    books: [],
    categories: [],
    orders: [],
    messages: [],
    announcements: [],
    editingBookCover: "",   // retained cover when editing without re-upload
    editingBookPdf: "",
    deleteTarget: null,     // { collection, id, after }
    pendingEmail: ""        // email awaiting OTP verification
  };

  var SECTION_META = {
    dashboard:     { title: "Dashboard",     sub: "Welcome back! Here's your overview." },
    books:         { title: "Books",         sub: "Add, edit and remove books in your store." },
    categories:    { title: "Categories",    sub: "Organise books into categories and age groups." },
    announcements: { title: "Announcements", sub: "Post updates shown on the homepage." },
    orders:        { title: "Orders",        sub: "Track and update customer orders." },
    analytics:     { title: "Analytics",     sub: "Visitor and sales insights." },
    messages:      { title: "Messages",      sub: "Enquiries sent from the contact page." }
  };

  var SESSION_KEY = "madube_admin_session";
  var OTP_OK_KEY = "madube_otp_ok";
  var TRUST_KEY = "madube_admin_trust_until";
  var TRUST_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  /* ---------------- init / auth ---------------- */
  function init() {
    if (fb.mode === "firestore" && fb.ready && fb.auth) {
      fb.auth.onAuthStateChanged(function (user) {
        if (!user) { showLogin(); return; }
        if (otpSatisfied()) { showDashboard(user.email || "Admin"); }
        else { beginOtp(user.email || ""); }
      });
    } else {
      // Local (offline) mode - session kept in sessionStorage.
      if (sessionStorage.getItem(SESSION_KEY)) {
        showDashboard(sessionStorage.getItem(SESSION_KEY));
      } else {
        showLogin();
      }
    }
  }

  function showLogin() {
    show("loginScreen"); hide("otpScreen"); hide("adminDashboard");
  }

  function showDashboard(email) {
    hide("loginScreen"); hide("otpScreen"); show("adminDashboard");
    var nameEl = document.getElementById("adminName");
    if (nameEl && email) nameEl.textContent = email.split("@")[0] || "Admin";
    var avatar = document.querySelector(".admin-avatar");
    if (avatar && email) avatar.textContent = (email[0] || "A").toUpperCase();
    if (fb.mode !== "firestore") showModeBanner();
    seedIfEmpty().then(loadAll);
  }

  function showModeBanner() {
    if (document.getElementById("modeBanner")) return;
    var bar = document.createElement("div");
    bar.id = "modeBanner";
    bar.className = "mode-banner";
    bar.textContent = "Demo mode: changes are saved in this browser only. " +
      "Add your Firebase config in js/firebase-config.js to publish changes to all visitors.";
    var content = document.querySelector(".admin-content");
    if (content) content.insertBefore(bar, content.firstChild);
  }

  function login(event) {
    event.preventDefault();
    var email = val("loginEmail").trim();
    var pass = val("loginPassword");
    var errEl = document.getElementById("loginError");
    hideEl(errEl);

    if (fb.mode === "firestore" && fb.ready && fb.auth) {
      fb.auth.signInWithEmailAndPassword(email, pass)
        .then(function () { /* onAuthStateChanged shows dashboard */ })
        .catch(function (err) {
          errEl.textContent = friendlyAuthError(err);
          showEl(errEl);
        });
    } else {
      // Local mode: accept any non-empty credentials (offline demo only).
      if (!email || !pass) {
        errEl.textContent = "Enter an email and password to continue.";
        showEl(errEl);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, email);
      showDashboard(email);
    }
  }

  function friendlyAuthError(err) {
    var code = (err && err.code) || "";
    if (code.indexOf("wrong-password") >= 0 || code.indexOf("invalid-credential") >= 0)
      return "Incorrect email or password.";
    if (code.indexOf("user-not-found") >= 0)
      return "No admin account found for that email.";
    if (code.indexOf("too-many-requests") >= 0)
      return "Too many attempts. Please wait a moment and try again.";
    return (err && err.message) || "Sign in failed. Please try again.";
  }

  function logout() {
    sessionStorage.removeItem(OTP_OK_KEY);
    if (fb.mode === "firestore" && fb.ready && fb.auth) {
      fb.auth.signOut();
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
    }
  }

  /* ---------------- OTP second factor ----------------
     After email+password succeeds, we email a 6-digit code via the
     adminAuth Cloud Function (/api/send-admin-code) and require it
     before showing the dashboard. If the endpoint is unavailable
     (e.g. running the files locally without functions deployed) the
     flow degrades gracefully and lets the admin straight in. */

  function otpSatisfied() {
    if (sessionStorage.getItem(OTP_OK_KEY)) return true;
    var until = parseInt(localStorage.getItem(TRUST_KEY) || "0", 10) || 0;
    return until > Date.now();
  }

  function markOtpOk(remember) {
    sessionStorage.setItem(OTP_OK_KEY, "1");
    if (remember) localStorage.setItem(TRUST_KEY, String(Date.now() + TRUST_MS));
  }

  function maskEmail(email) {
    var parts = String(email || "").split("@");
    if (parts.length !== 2) return email || "your email";
    var n = parts[0];
    return (n.length <= 2 ? n[0] : n.slice(0, 2)) + "***@" + parts[1];
  }

  function apiPost(path, body) {
    if (!(fb.auth && fb.auth.currentUser)) return Promise.reject(new Error("not-authenticated"));
    return fb.auth.currentUser.getIdToken().then(function (token) {
      return fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(body || {})
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { status: r.status, body: j };
        });
      });
    });
  }

  function sendAdminCode() {
    return apiPost("/api/send-admin-code", {}).then(function (res) {
      if (res.status === 404) return { unavailable: true };
      return res;
    }).catch(function () { return { unavailable: true }; });
  }

  function beginOtp(email) {
    state.pendingEmail = email;
    hide("loginScreen"); hide("adminDashboard"); show("otpScreen");
    setText("otpEmailTarget", maskEmail(email));
    setText("otpInfo", "Sending your code...");
    setVal("otpCode", "");
    hideEl(document.getElementById("otpError"));

    sendAdminCode().then(function (res) {
      if (res.unavailable) {
        console.warn("[MaDube] OTP endpoint unavailable; skipping second factor.");
        markOtpOk(false);
        showDashboard(email);
        return;
      }
      if (res.status === 200 && res.body.ok) {
        setText("otpInfo", "We sent a code to " + (res.body.email || maskEmail(email)) + ".");
      } else {
        setText("otpInfo", "");
        showOtpError(res.body.error || "Could not send the code.");
      }
    }).catch(function (err) {
      console.warn("[MaDube] send code failed:", err);
      markOtpOk(false);
      showDashboard(email);
    });
  }

  function verifyOtp(event) {
    if (event) event.preventDefault();
    var code = val("otpCode").trim();
    var rememberEl = document.getElementById("otpRemember");
    var remember = !!(rememberEl && rememberEl.checked);
    hideEl(document.getElementById("otpError"));
    if (!/^\d{6}$/.test(code)) { showOtpError("Enter the 6-digit code."); return; }

    apiPost("/api/verify-admin-code", { code: code }).then(function (res) {
      if (res.status === 200 && res.body.verified) {
        markOtpOk(remember);
        showDashboard(state.pendingEmail || val("loginEmail"));
      } else {
        showOtpError(res.body.error || "Incorrect code.");
      }
    }).catch(function () {
      showOtpError("Could not verify the code. Please try again.");
    });
  }

  function resendCode() {
    setText("otpInfo", "Resending...");
    sendAdminCode().then(function (res) {
      if (res.unavailable) { MaDube.toast("OTP service is not available."); return; }
      if (res.status === 200 && res.body.ok) {
        setText("otpInfo", "A new code is on its way.");
        MaDube.toast("Code resent.");
      } else {
        showOtpError(res.body.error || "Could not resend the code.");
      }
    });
  }

  function cancelOtp() {
    if (fb.auth) fb.auth.signOut();
    state.pendingEmail = "";
    showLogin();
  }

  function showOtpError(msg) {
    var e = document.getElementById("otpError");
    if (e) { e.textContent = msg; e.classList.remove("hidden"); }
  }

  /* ---------------- data loading ---------------- */
  /* Bump CATALOGUE_VERSION whenever the built-in book list in
     catalogue.js is deliberately replaced. On the next admin sign-in
     this wipes every existing book and category and reloads the new
     defaults once, then records the version so it does not repeat. */
  var CATALOGUE_VERSION = "2026-07-22-books-v2";
  var VERSION_KEY = "madube_catalogue_version";

  function storedCatalogueVersion() {
    try { return localStorage.getItem(VERSION_KEY); } catch (e) { return null; }
  }
  function saveCatalogueVersion() {
    try { localStorage.setItem(VERSION_KEY, CATALOGUE_VERSION); } catch (e) {}
  }

  function seedIfEmpty() {
    var C = MaDube.Catalogue;
    var needsReset = storedCatalogueVersion() !== CATALOGUE_VERSION;

    return Promise.all([DB.list("books"), DB.list("categories")]).then(function (res) {
      var books = res[0] || [];
      var cats = res[1] || [];

      if (needsReset) {
        // Deliberate catalogue replace: remove all books + categories first,
        // then load the current defaults, then remember this version.
        var removals = books.map(function (b) { return DB.remove("books", b.id); })
          .concat(cats.map(function (c) { return DB.remove("categories", c.id); }));
        return Promise.all(removals).then(function () {
          var writes = C.DEFAULT_BOOKS.map(function (b) { return DB.set("books", b.id, b); })
            .concat(C.DEFAULT_CATEGORIES.map(function (c) { return DB.set("categories", c.id, c); }));
          return Promise.all(writes);
        }).then(saveCatalogueVersion);
      }

      // Normal path: only fill in a collection when it is empty.
      var jobs = [];
      if (!books.length) {
        C.DEFAULT_BOOKS.forEach(function (b) { jobs.push(DB.set("books", b.id, b)); });
      }
      if (!cats.length) {
        C.DEFAULT_CATEGORIES.forEach(function (c) { jobs.push(DB.set("categories", c.id, c)); });
      }
      return Promise.all(jobs);
    }).catch(function (e) { console.warn("[MaDube] seed skipped:", e); });
  }

  function loadAll() {
    return Promise.all([
      DB.list("books"), DB.list("categories"),
      DB.list("orders"), DB.list("messages"), DB.list("announcements")
    ]).then(function (r) {
      state.books = r[0] || [];
      state.categories = r[1] || [];
      state.orders = (r[2] || []).sort(byDateDesc);
      state.messages = (r[3] || []).sort(byDateDesc);
      state.announcements = (r[4] || []).sort(byDateDesc);

      populateCategorySelect();
      renderBooksTable();
      renderCategories();
      renderAnnouncements();
      renderOrders();
      renderMessages();
      renderDashboard();
      renderAnalytics();
    }).catch(function (e) {
      console.error("[MaDube] load failed:", e);
      MaDube.toast("Could not load data. Check the console for details.");
    });
  }

  function byDateDesc(a, b) {
    return String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || ""));
  }

  /* ---------------- navigation ---------------- */
  function switchSection(section, el) {
    state.section = section;
    document.querySelectorAll(".admin-section").forEach(function (s) { s.classList.remove("active"); });
    var target = document.getElementById("section-" + section);
    if (target) target.classList.add("active");

    document.querySelectorAll(".sidebar-link").forEach(function (l) {
      l.classList.toggle("active", l.getAttribute("data-section") === section);
    });

    var meta = SECTION_META[section] || { title: section, sub: "" };
    setText("sectionTitle", meta.title);
    setText("sectionSubtitle", meta.sub);
    if (window.innerWidth <= 1024) closeSidebar();
  }

  function toggleSidebar() { document.getElementById("adminSidebar").classList.toggle("open"); }
  function closeSidebar() { var s = document.getElementById("adminSidebar"); if (s) s.classList.remove("open"); }

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    setText("totalBooks", state.books.length);
    setText("totalOrders", state.orders.length);
    setText("totalRevenue", U.money(sumRevenue(state.orders)));
    setText("totalVisitors", getVisits());

    var recent = state.orders.slice(0, 5);
    var tbody = document.getElementById("recentOrdersTable");
    if (!tbody) return;
    if (!recent.length) {
      tbody.innerHTML = emptyRow(6, "No orders yet");
      return;
    }
    tbody.innerHTML = recent.map(function (o) {
      return "<tr>" +
        td(o.ref || o.id) +
        td(U.escapeHtml(o.name)) +
        td(U.escapeHtml(orderBooks(o))) +
        td(U.money(o.total)) +
        td(statusBadge(o.status || "pending")) +
        td(U.formatDate(o.date || o.createdAt)) +
        "</tr>";
    }).join("");
  }

  function sumRevenue(orders) {
    return orders.reduce(function (s, o) {
      return s + ((o.status === "paid") ? (Number(o.total) || 0) : 0);
    }, 0);
  }

  function orderBooks(o) {
    var items = o.items || {};
    var titles = Object.keys(items).map(function (id) {
      var b = findBook(id);
      var t = b ? (b.title || "") : id;
      return t.split(" - ")[0].trim() + (items[id] > 1 ? " x" + items[id] : "");
    });
    return titles.join(", ") || "-";
  }

  function findBook(id) {
    return state.books.filter(function (b) { return b.id === id; })[0] ||
      MaDube.Catalogue.DEFAULT_BOOKS.filter(function (b) { return b.id === id; })[0] || null;
  }

  /* ---------------- books ---------------- */
  function renderBooksTable() {
    var tbody = document.getElementById("booksTable");
    if (!tbody) return;
    if (!state.books.length) {
      tbody.innerHTML = emptyRow(6, "No books yet. Click \"Add New Book\" to create one.");
      return;
    }
    tbody.innerHTML = state.books.map(function (b) {
      var cover = b.img || b.coverImage || "";
      var thumb = cover
        ? "<img src=\"" + U.escapeHtml(cover) + "\" alt=\"\" style=\"width:40px;height:52px;object-fit:cover;border-radius:6px;\">"
        : "<div style=\"width:40px;height:52px;border-radius:6px;background:var(--light-gray);\"></div>";
      var age = b.age || (b.ageGroup ? "Ages " + b.ageGroup : "-");
      return "<tr>" +
        td(thumb) +
        td(U.escapeHtml((b.title || "").split(" - ")[0])) +
        td(U.escapeHtml(age)) +
        td(U.money(b.price)) +
        td(statusBadge(b.status || "published")) +
        td(
          "<div class=\"books-table-actions\">" +
          "<button class=\"btn-edit\" title=\"Edit\" onclick=\"MaDube.Admin.editBook('" + b.id + "')\">Edit</button>" +
          "<button class=\"btn-delete\" title=\"Delete\" onclick=\"MaDube.Admin.askDeleteBook('" + b.id + "')\">Del</button>" +
          "</div>"
        ) +
        "</tr>";
    }).join("");
  }

  function populateCategorySelect() {
    var sel = document.getElementById("bookCategorySelect");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = "<option value=\"\">Select category</option>" +
      state.categories.map(function (c) {
        return "<option value=\"" + c.id + "\">" + U.escapeHtml(c.name) + "</option>";
      }).join("");
    sel.value = current;
  }

  function showBookForm(book) {
    show("bookFormPanel"); hide("booksListPanel");
    var form = document.getElementById("bookForm");
    if (form) form.reset();
    hide("coverPreview"); hide("pdfPreview");
    state.editingBookCover = ""; state.editingBookPdf = "";

    if (book) {
      setText("bookFormTitle", "Edit Book");
      setVal("editBookId", book.id);
      setVal("bookTitleInput", book.title || "");
      setVal("bookAuthorInput", book.author || "");
      setVal("bookAgeGroup", book.ageGroup || ageToGroup(book.age));
      setVal("bookCategorySelect", book.categoryId || "");
      setVal("bookPriceInput", book.price != null ? book.price : "");
      setVal("bookStatus", book.status || "published");
      setVal("bookSummaryInput", book.summary || book.desc || "");
      state.editingBookCover = book.img || book.coverImage || "";
      state.editingBookPdf = book.pdf || "";
      if (state.editingBookCover) {
        setPreview("coverPreview", "<img src=\"" + U.escapeHtml(state.editingBookCover) + "\" alt=\"\"> Current cover");
      }
    } else {
      setText("bookFormTitle", "Add New Book");
      setVal("editBookId", "");
    }
  }

  function hideBookForm() { hide("bookFormPanel"); show("booksListPanel"); }

  function editBook(id) {
    var b = state.books.filter(function (x) { return x.id === id; })[0];
    if (b) showBookForm(b);
  }

  function saveBook(event) {
    event.preventDefault();
    var btn = document.getElementById("saveBookBtn");
    var id = val("editBookId");
    var catId = val("bookCategorySelect");
    var cat = state.categories.filter(function (c) { return c.id === catId; })[0];

    var record = {
      title: val("bookTitleInput").trim(),
      author: val("bookAuthorInput").trim(),
      ageGroup: val("bookAgeGroup"),
      age: val("bookAgeGroup") ? "Ages " + val("bookAgeGroup") : "",
      categoryId: catId,
      categoryName: cat ? cat.name : "",
      type: cat ? cat.name : "Book",
      price: parseFloat(val("bookPriceInput")) || 0,
      status: val("bookStatus"),
      summary: val("bookSummaryInput").trim(),
      img: state.editingBookCover,
      pdf: state.editingBookPdf
    };

    if (!record.title || !record.ageGroup || !record.summary) {
      MaDube.toast("Please fill in title, age group and summary.");
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }

    var coverFile = fileOf("coverImageFile");
    var pdfFile = fileOf("pdfFile");

    Promise.resolve()
      .then(function () { return coverFile ? storeFile(coverFile, "covers") : record.img; })
      .then(function (coverUrl) { record.img = coverUrl || ""; })
      .then(function () { return pdfFile ? storeFile(pdfFile, "pdfs") : record.pdf; })
      .then(function (pdfUrl) { record.pdf = pdfUrl || ""; })
      .then(function () {
        return id ? DB.set("books", id, record) : DB.add("books", record);
      })
      .then(function () {
        MaDube.toast(id ? "Book updated." : "Book added.");
        hideBookForm();
        return loadAll();
      })
      .catch(function (err) {
        console.error(err);
        MaDube.toast(quotaMessage(err) || "Could not save the book.");
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.textContent = "Save Book"; }
      });
  }

  function askDeleteBook(id) {
    var b = state.books.filter(function (x) { return x.id === id; })[0];
    openDeleteModal("books", id,
      "Delete \"" + ((b && b.title) || "this book") + "\"? This cannot be undone.");
  }

  /* ---------------- categories ---------------- */
  function renderCategories() {
    var host = document.getElementById("categoriesList");
    if (!host) return;
    if (!state.categories.length) {
      host.innerHTML = "<p class=\"text-light\">No categories yet.</p>";
      return;
    }
    host.innerHTML = state.categories.map(function (c) {
      return "<div class=\"category-row\">" +
        "<span class=\"category-swatch\" style=\"background:" + (c.color || "#ccc") + "\"></span>" +
        "<div class=\"category-meta\">" +
          "<strong>" + U.escapeHtml(c.icon ? c.icon + " " : "") + U.escapeHtml(c.name) + "</strong>" +
          "<span>" + U.escapeHtml(c.description || "") + "</span>" +
        "</div>" +
        "<div class=\"category-actions\">" +
          "<button class=\"btn-edit\" onclick=\"MaDube.Admin.editCategory('" + c.id + "')\">Edit</button>" +
          "<button class=\"btn-delete\" onclick=\"MaDube.Admin.askDeleteCategory('" + c.id + "')\">Del</button>" +
        "</div>" +
      "</div>";
    }).join("");
  }

  function addCategory(event) {
    event.preventDefault();
    var id = val("editCategoryId");
    var record = {
      name: val("newCategoryName").trim(),
      description: val("newCategoryDesc").trim(),
      icon: val("newCategoryIcon").trim(),
      color: val("newCategoryColor")
    };
    if (!record.name) { MaDube.toast("Enter a category name."); return; }

    var op = id ? DB.set("categories", id, record) : DB.add("categories", record);
    op.then(function () {
      MaDube.toast(id ? "Category updated." : "Category added.");
      cancelEditCategory();
      return loadAll();
    }).catch(function (err) {
      console.error(err);
      MaDube.toast(quotaMessage(err) || "Could not save the category.");
    });
  }

  function editCategory(id) {
    var c = state.categories.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    setVal("editCategoryId", c.id);
    setVal("newCategoryName", c.name || "");
    setVal("newCategoryDesc", c.description || "");
    setVal("newCategoryIcon", c.icon || "");
    setVal("newCategoryColor", c.color || "#7EC8E3");
    setText("categoryFormTitle", "Edit Category");
    setText("saveCategoryBtn", "Save Changes");
    show("cancelEditCategoryBtn");
  }

  function cancelEditCategory() {
    setVal("editCategoryId", "");
    var f = document.getElementById("categoryForm");
    if (f) f.reset();
    setVal("newCategoryColor", "#7EC8E3");
    setText("categoryFormTitle", "Add Category");
    setText("saveCategoryBtn", "+ Add Category");
    hide("cancelEditCategoryBtn");
  }

  function askDeleteCategory(id) {
    var c = state.categories.filter(function (x) { return x.id === id; })[0];
    openDeleteModal("categories", id,
      "Delete category \"" + ((c && c.name) || "") + "\"?");
  }

  /* ---------------- announcements ---------------- */
  function renderAnnouncements() {
    var host = document.getElementById("announcementsList");
    if (!host) return;
    if (!state.announcements.length) {
      host.innerHTML = "<p class=\"text-light\">No announcements yet.</p>";
      return;
    }
    host.innerHTML = state.announcements.map(function (a) {
      var live = String(a.active) === "true" || a.active === true;
      return "<div class=\"announcement-row\">" +
        "<div>" +
          "<strong>" + U.escapeHtml(a.title) + "</strong> " +
          "<span class=\"pill " + (live ? "pill-on" : "pill-off") + "\">" + (live ? "Live" : "Draft") + "</span>" +
          "<p class=\"text-light\">" + U.escapeHtml(a.message || "") + "</p>" +
          "<small class=\"text-light\">" + U.formatDate(a.createdAt || a.date) + "</small>" +
        "</div>" +
        "<button class=\"btn-delete\" onclick=\"MaDube.Admin.askDeleteAnnouncement('" + a.id + "')\">Del</button>" +
      "</div>";
    }).join("");
  }

  function postAnnouncement(event) {
    event.preventDefault();
    var record = {
      title: val("announcementTitle").trim(),
      message: val("announcementMessage").trim(),
      active: val("announcementActive") === "true",
      date: new Date().toISOString()
    };
    if (!record.title || !record.message) { MaDube.toast("Enter a title and message."); return; }
    DB.add("announcements", record).then(function () {
      MaDube.toast("Announcement posted.");
      var f = event.target; if (f && f.reset) f.reset();
      return loadAll();
    }).catch(function (err) {
      console.error(err);
      MaDube.toast(quotaMessage(err) || "Could not post the announcement.");
    });
  }

  function askDeleteAnnouncement(id) {
    openDeleteModal("announcements", id, "Delete this announcement?");
  }

  /* ---------------- orders ---------------- */
  function filterOrders(status, el) {
    state.orderFilter = status;
    document.querySelectorAll(".order-status-bar .tag").forEach(function (t) { t.classList.remove("active"); });
    if (el) el.classList.add("active");
    renderOrders();
  }

  function renderOrders() {
    var tbody = document.getElementById("ordersTable");
    var list = state.orders.filter(function (o) {
      return state.orderFilter === "all" || (o.status || "pending") === state.orderFilter;
    });

    if (tbody) {
      if (!list.length) {
        tbody.innerHTML = emptyRow(9, "No orders found");
      } else {
        tbody.innerHTML = list.map(function (o) {
          var st = o.status || "pending";
          return "<tr>" +
            td(o.ref || o.id) +
            td(U.escapeHtml(o.name)) +
            td(U.escapeHtml(o.email)) +
            td(U.escapeHtml(orderBooks(o))) +
            td(U.money(o.total)) +
            td(U.escapeHtml(o.method || "-")) +
            td(statusBadge(st)) +
            td(U.formatDate(o.date || o.createdAt)) +
            td(orderActions(o)) +
            "</tr>";
        }).join("");
      }
    }

    // Summary cards
    var paid = state.orders.filter(function (o) { return o.status === "paid"; });
    var pending = state.orders.filter(function (o) { return (o.status || "pending") === "pending"; });
    setText("salesTotal", U.money(sumRevenue(state.orders)));
    setText("ordersPaid", paid.length);
    setText("ordersPending", pending.length);
    setText("bestSeller", bestSeller() || "-");
  }

  function orderActions(o) {
    var id = o.id;
    return "<select class=\"order-status-select\" onchange=\"MaDube.Admin.setOrderStatus('" + id + "', this.value)\">" +
      opt("pending", o.status) + opt("paid", o.status) + opt("cancelled", o.status) +
      "</select>";
  }
  function opt(v, cur) {
    return "<option value=\"" + v + "\"" + ((cur || "pending") === v ? " selected" : "") + ">" +
      v.charAt(0).toUpperCase() + v.slice(1) + "</option>";
  }

  function setOrderStatus(id, status) {
    DB.set("orders", id, { status: status }).then(function () {
      var o = state.orders.filter(function (x) { return x.id === id; })[0];
      if (o) o.status = status;
      renderOrders(); renderDashboard();
      MaDube.toast("Order marked " + status + ".");
    }).catch(function (err) { console.error(err); MaDube.toast("Could not update order."); });
  }

  function bestSeller() {
    var tally = {};
    state.orders.forEach(function (o) {
      var items = o.items || {};
      Object.keys(items).forEach(function (id) { tally[id] = (tally[id] || 0) + items[id]; });
    });
    var top = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
    if (!top) return "";
    var b = findBook(top);
    return b ? (b.title || "").split(" - ")[0].trim() : top;
  }

  /* ---------------- messages ---------------- */
  function renderMessages() {
    var tbody = document.getElementById("messagesTable");
    setText("messagesCount", state.messages.length);
    if (!tbody) return;
    if (!state.messages.length) {
      tbody.innerHTML = emptyRow(6, "No messages yet");
      return;
    }
    tbody.innerHTML = state.messages.map(function (m) {
      return "<tr>" +
        td(U.formatDate(m.date || m.createdAt)) +
        td(U.escapeHtml(m.name)) +
        td(U.escapeHtml(m.email)) +
        td(U.escapeHtml(m.subject || m.interest || "-")) +
        td("<span title=\"" + U.escapeHtml(m.message || "") + "\">" + U.escapeHtml((m.message || "").slice(0, 60)) + "</span>") +
        td("<button class=\"btn-delete\" onclick=\"MaDube.Admin.askDeleteMessage('" + m.id + "')\">Del</button>") +
        "</tr>";
    }).join("");
  }

  function askDeleteMessage(id) {
    openDeleteModal("messages", id, "Delete this message?");
  }

  /* ---------------- analytics ---------------- */
  function renderAnalytics() {
    var visits = getVisits();
    setText("analyticsVisitors", visits);
    var dev = getDeviceSplit();
    setText("analyticsMobile", dev.mobile + "%");
    setText("analyticsDesktop", dev.desktop + "%");

    // Popular books = purchase tally from orders
    var tally = {};
    state.orders.forEach(function (o) {
      var items = o.items || {};
      Object.keys(items).forEach(function (id) { tally[id] = (tally[id] || 0) + items[id]; });
    });
    var ranked = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    setText("analyticsMostViewed", ranked.length ? (function () {
      var b = findBook(ranked[0]); return b ? (b.title || "").split(" - ")[0].trim() : ranked[0];
    })() : "-");

    var tbody = document.getElementById("popularBooksTable");
    if (tbody) {
      if (!ranked.length) {
        tbody.innerHTML = emptyRow(4, "No data available yet");
      } else {
        tbody.innerHTML = ranked.map(function (id) {
          var b = findBook(id);
          var qty = tally[id];
          var revenue = (b ? Number(b.price) || 0 : 0) * qty;
          return "<tr>" +
            td(U.escapeHtml(b ? (b.title || "").split(" - ")[0].trim() : id)) +
            td("-") +
            td(String(qty)) +
            td(U.money(revenue)) +
            "</tr>";
        }).join("");
      }
    }
  }

  function getVisits() {
    return parseInt(localStorage.getItem("madube_visits") || "0", 10) || 0;
  }
  function getDeviceSplit() {
    var m = parseInt(localStorage.getItem("madube_visits_mobile") || "0", 10);
    var d = parseInt(localStorage.getItem("madube_visits_desktop") || "0", 10);
    var total = m + d;
    if (!total) return { mobile: 0, desktop: 0 };
    return { mobile: Math.round(m / total * 100), desktop: Math.round(d / total * 100) };
  }

  /* ---------------- delete modal ---------------- */
  function openDeleteModal(collection, id, message) {
    state.deleteTarget = { collection: collection, id: id };
    setText("deleteMessage", message || "Delete this item?");
    var modal = document.getElementById("deleteModal");
    if (modal) modal.classList.add("open");
  }
  function closeDeleteModal() {
    state.deleteTarget = null;
    var modal = document.getElementById("deleteModal");
    if (modal) modal.classList.remove("open");
  }
  function confirmDelete() {
    var t = state.deleteTarget;
    if (!t) return;
    DB.remove(t.collection, t.id).then(function () {
      MaDube.toast("Deleted.");
      closeDeleteModal();
      return loadAll();
    }).catch(function (err) { console.error(err); MaDube.toast("Could not delete."); });
  }

  /* ---------------- file handling ---------------- */
  function previewFile(input, previewId) {
    var file = input.files && input.files[0];
    if (!file) { hide(previewId); return; }
    if (/^image\//.test(file.type)) {
      U.readFileAsDataURL(file).then(function (url) {
        setPreview(previewId, "<img src=\"" + url + "\" alt=\"\"> " + U.escapeHtml(file.name));
      });
    } else {
      setPreview(previewId, U.escapeHtml(file.name));
    }
  }

  // Upload to Firebase Storage when available; otherwise embed as data URL.
  function storeFile(file, folder) {
    if (fb.mode === "firestore" && fb.storage) {
      var ref = fb.storage.ref().child(folder + "/" + Date.now() + "-" + file.name);
      return ref.put(file).then(function (snap) { return snap.ref.getDownloadURL(); })
        .catch(function (err) {
          console.warn("[MaDube] storage upload failed, embedding instead:", err);
          return U.readFileAsDataURL(file);
        });
    }
    return U.readFileAsDataURL(file);
  }

  function quotaMessage(err) {
    if (err && (err.name === "QuotaExceededError" || String(err).indexOf("quota") >= 0)) {
      return "Browser storage is full. Use smaller images, or add Firebase to store files online.";
    }
    return null;
  }

  /* ---------------- tiny DOM helpers ---------------- */
  function show(id) { var e = document.getElementById(id); if (e) e.classList.remove("hidden"); }
  function hide(id) { var e = document.getElementById(id); if (e) e.classList.add("hidden"); }
  function showEl(e) { if (e) e.classList.remove("hidden"); }
  function hideEl(e) { if (e) e.classList.add("hidden"); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function setVal(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
  function setText(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function fileOf(id) { var e = document.getElementById(id); return e && e.files ? e.files[0] : null; }
  function setPreview(id, html) { var e = document.getElementById(id); if (e) { e.innerHTML = html; e.classList.remove("hidden"); } }
  function td(html) { return "<td>" + html + "</td>"; }
  function emptyRow(cols, msg) {
    return "<tr><td colspan=\"" + cols + "\" class=\"text-center\" style=\"padding:2rem;\">" +
      "<p class=\"text-light\">" + U.escapeHtml(msg) + "</p></td></tr>";
  }
  function statusBadge(status) {
    var s = (status || "").toLowerCase();
    return "<span class=\"status-badge status-" + s + "\">" +
      (s.charAt(0).toUpperCase() + s.slice(1)) + "</span>";
  }
  function ageToGroup(age) {
    if (!age) return "";
    var m = String(age).match(/(\d+)\s*-\s*(\d+)/);
    if (m) return m[1] + "-" + m[2];
    return "";
  }

  document.addEventListener("DOMContentLoaded", init);

  /* Public API (matches admin.html onclick handlers) */
  return {
    login: login, logout: logout,
    verifyOtp: verifyOtp, resendCode: resendCode, cancelOtp: cancelOtp,
    switchSection: switchSection, toggleSidebar: toggleSidebar,
    showBookForm: showBookForm, hideBookForm: hideBookForm,
    editBook: editBook, saveBook: saveBook, askDeleteBook: askDeleteBook,
    previewFile: previewFile,
    addCategory: addCategory, editCategory: editCategory,
    cancelEditCategory: cancelEditCategory, askDeleteCategory: askDeleteCategory,
    postAnnouncement: postAnnouncement, askDeleteAnnouncement: askDeleteAnnouncement,
    filterOrders: filterOrders, setOrderStatus: setOrderStatus,
    askDeleteMessage: askDeleteMessage,
    openDeleteModal: openDeleteModal, closeDeleteModal: closeDeleteModal, confirmDelete: confirmDelete
  };
})();
