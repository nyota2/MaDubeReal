/* ============================================================
   MaDube Books - cart + storefront logic (no build tools)
   ============================================================ */

/* ---- Product catalogue ----
   Books now come from the shared catalogue (js/catalogue.js), which
   reads saved books from MaDube.DB (Firestore or localStorage) and
   falls back to the built-in defaults. PRODUCTS starts with those
   defaults so the page renders instantly, then refreshes once the
   DB responds (see loadCatalogue in the init block below). */
let PRODUCTS = (window.MaDube && MaDube.Catalogue)
  ? MaDube.Catalogue.DEFAULT_BOOKS.slice()
  : [];

const CURRENCY = 'US$';
const money = n => CURRENCY + n.toFixed(2);

/* ---- Cart storage ---- */
const CART_KEY = 'madube_cart';
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '{}');
const saveCart = c => localStorage.setItem(CART_KEY, JSON.stringify(c));

function addToCart(id, qty=1){
  const cart = getCart();
  cart[id] = (cart[id] || 0) + qty;
  saveCart(cart);
  renderCart();
  const p = PRODUCTS.find(p=>p.id===id);
  toast(`Added “${p ? p.title.split(' - ')[0].trim() : 'item'}” to cart`);
  openDrawer();
}
function setQty(id, qty){
  const cart = getCart();
  if(qty <= 0){ delete cart[id]; } else { cart[id] = qty; }
  saveCart(cart); renderCart();
}
function removeItem(id){ const c=getCart(); delete c[id]; saveCart(c); renderCart(); }
function cartCount(){ return Object.values(getCart()).reduce((a,b)=>a+b,0); }
function cartTotal(){
  const c=getCart();
  return Object.entries(c).reduce((sum,[id,q])=>{
    const p=PRODUCTS.find(p=>p.id===id); return sum + (p ? p.price*q : 0);
  },0);
}

/* ---- Cover markup helper ---- */
function coverHTML(p){
  if(p.img){
    return `<img class="cover-img" src="${p.img}" alt="${p.title} cover" loading="lazy">`;
  }
  // typographic fallback for books without a photographed cover yet
  return `<div class="bookcover ${p.cover}">
      <div><div class="kicker">${p.kicker}</div></div>
      <div>
        <div class="title">${p.title.split(' - ')[0].trim()}</div>
        <div class="sub">${p.sub}</div>
      </div>
      <div class="age">${p.age}</div>
    </div>`;
}

/* ---- Render product grids (any element with data-products) ---- */
function renderProducts(){
  document.querySelectorAll('[data-products]').forEach(host=>{
    const limit = parseInt(host.dataset.products) || PRODUCTS.length;
    if(host.hasAttribute('data-simple')){
      // teaser cards: cover only - each card links to its book page
      host.innerHTML = PRODUCTS.slice(0, limit).map(p=>`
        <a class="card card-cover" href="book.html?id=${p.id}" aria-label="${p.title} - view book">
          <div class="cover-wrap">${coverHTML(p)}</div>
        </a>`).join('');
      return;
    }
    host.innerHTML = PRODUCTS.slice(0, limit).map(p=>`
      <article class="card">
        <a href="book.html?id=${p.id}" aria-label="${p.title} - view book">
          <div class="cover-wrap">${coverHTML(p)}</div>
        </a>
        <div class="body">
          <div class="tags"><span class="tag">${p.type}</span>${p.lang ? `<span class="tag lang">${p.lang}</span>` : ''}</div>
          <h3><a href="book.html?id=${p.id}">${p.title.split(' - ')[1] ? p.title.split(' - ')[1].trim() : p.title}</a></h3>
          <p class="desc">${p.desc}</p>
          <div class="price-row">
            <span class="price">${money(p.price)}</span>
            <a class="add" href="book.html?id=${p.id}">View book</a>
          </div>
        </div>
      </article>`).join('');
  });
}

/* ---- Book detail page (book.html?id=...) ---- */
function detailQtyEl(){ return document.getElementById('detailQty'); }
function bumpDetailQty(dir){
  const el = detailQtyEl(); if(!el) return;
  el.textContent = Math.max(1, (parseInt(el.textContent)||1) + dir);
}
function addDetailToCart(id){
  const el = detailQtyEl();
  addToCart(id, el ? (parseInt(el.textContent)||1) : 1);
  if(el) el.textContent = 1;
}
function renderBookPage(){
  const host = document.querySelector('[data-book-detail]');
  if(!host) return;
  const id = new URLSearchParams(location.search).get('id');
  const p = PRODUCTS.find(p=>p.id===id);
  if(!p){
    host.innerHTML = `<div class="empty-cart" style="margin:60px 0">
      <p>Sorry, we couldn't find that book.</p>
      <p style="margin-top:14px"><a class="btn btn-primary" href="shop.html">Browse all books →</a></p></div>`;
    return;
  }
  document.title = `${p.title} | MaDube Books`;
  const crumb = document.querySelector('[data-book-crumb]');
  if(crumb) crumb.textContent = p.title.split(' - ')[0].trim();
  host.innerHTML = `
    <div class="book-detail">
      <div class="bd-cover">${coverHTML(p)}</div>
      <div class="bd-info">
        <div class="tags"><span class="tag">${p.type}</span>${p.lang ? `<span class="tag lang">${p.lang}</span>` : ''}${p.age ? `<span class="tag age">${p.age}</span>` : ''}</div>
        <h1>${p.title}</h1>
        <div class="bd-price">${money(p.price)}</div>
        <p class="bd-summary">${p.summary || p.desc}</p>
        <ul class="bd-facts">
          ${p.lang ? `<li><strong>Language</strong>${p.lang}</li>` : ''}
          ${p.age ? `<li><strong>Age range</strong>${p.age}</li>` : ''}
          <li><strong>Category</strong>${p.type}</li>
          ${p.format ? `<li><strong>Format</strong>${p.format}</li>` : ''}
        </ul>
        <div class="bd-actions">
          <div class="qty bd-qty">
            <button onclick="bumpDetailQty(-1)" aria-label="Decrease quantity">−</button>
            <span id="detailQty">1</span>
            <button onclick="bumpDetailQty(1)" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary" onclick="addDetailToCart('${p.id}')">Add to cart</button>
        </div>
      </div>
    </div>`;
  // related books: everything except the current one, up to 4
  const rel = document.querySelector('[data-related]');
  if(rel){
    rel.innerHTML = PRODUCTS.filter(x=>x.id!==p.id).slice(0,4).map(x=>`
      <a class="card card-cover" href="book.html?id=${x.id}" aria-label="${x.title} - view book">
        <div class="cover-wrap">${coverHTML(x)}</div>
      </a>`).join('');
  }
}

/* ---- Cart drawer ---- */
function renderCart(){
  document.querySelectorAll('.cart-count').forEach(el=>el.textContent = cartCount());
  const body = document.getElementById('drawerBody');
  const foot = document.getElementById('drawerTotal');
  const cart = getCart();
  const ids = Object.keys(cart);
  if(body){
    if(!ids.length){
      body.innerHTML = `<div class="empty-cart"><p>Your basket is empty.</p><p style="font-size:.85rem;margin-top:6px">Browse our books and add your favourites!</p></div>`;
    } else {
      body.innerHTML = ids.map(id=>{
        const p=PRODUCTS.find(p=>p.id===id); if(!p) return '';
        const q=cart[id];
        return `<div class="cart-item">
          ${p.img
            ? `<img class="thumb" src="${p.img}" alt="" style="object-fit:cover">`
            : `<div class="thumb bookcover ${p.cover}" style="padding:0"></div>`}
          <div class="ci-body">
            <h4>${p.title.split(' - ')[0].trim()}</h4>
            <div class="ci-meta">${p.lang}</div>
            <div class="qty">
              <button onclick="setQty('${id}',${q-1})">−</button>
              <span>${q}</span>
              <button onclick="setQty('${id}',${q+1})">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div class="ci-price">${money(p.price*q)}</div>
            <button class="rm" onclick="removeItem('${id}')">remove</button>
          </div>
        </div>`;
      }).join('');
    }
  }
  if(foot) foot.textContent = money(cartTotal());
}

const drawer  = () => document.getElementById('cartDrawer');
const overlay = () => document.getElementById('drawerOverlay');
function openDrawer(){ drawer()?.classList.add('open'); overlay()?.classList.add('open'); }
function closeDrawer(){ drawer()?.classList.remove('open'); overlay()?.classList.remove('open'); }

/* ---- Toast ---- */
let toastTimer;
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---- Mobile nav ---- */
function toggleNav(){ document.querySelector('.nav-links')?.classList.toggle('open'); }

/* ---- Hero carousel ---- */
let slideIndex = 0, slideTimer = null;
function slideCount(){ return document.querySelectorAll('#heroSlides .slide').length; }
function goToSlide(i){
  const n = slideCount(); if(!n) return;
  slideIndex = (i + n) % n;
  document.getElementById('heroSlides').style.transform = `translateX(-${slideIndex * 100}%)`;
  document.querySelectorAll('#heroDots button').forEach((d,di)=>d.classList.toggle('active', di===slideIndex));
  restartSlideTimer();
}
function moveSlide(dir){ goToSlide(slideIndex + dir); }
function restartSlideTimer(){
  clearInterval(slideTimer);
  slideTimer = setInterval(()=>goToSlide(slideIndex + 1), 6000);
}
function initCarousel(){
  const n = slideCount(); if(!n) return;
  const dots = document.getElementById('heroDots');
  if(dots){
    dots.innerHTML = Array.from({length:n}, (_,i)=>
      `<button class="${i===0?'active':''}" onclick="goToSlide(${i})" aria-label="Go to slide ${i+1}"></button>`).join('');
  }
  restartSlideTimer();
}

/* ---- Init ---- */
function injectNavCart(){
  const nav = document.getElementById('navLinks');
  if(!nav || nav.querySelector('.nav-cart')) return;
  const a = document.createElement('a');
  a.href = '#';
  a.className = 'nav-cart';
  a.innerHTML = 'Cart <span class="count cart-count">0</span>';
  a.addEventListener('click', e=>{ e.preventDefault(); toggleNav(); openDrawer(); });
  nav.appendChild(a);
}
/* ---- Auto-advance the horizontal book sliders on mobile ---- */
function initBookSliders(){
  document.querySelectorAll('.grid[data-simple],.grid[data-related]').forEach(row=>{
    let pauseUntil = 0;
    ['touchstart','pointerdown','wheel'].forEach(ev=>
      row.addEventListener(ev, ()=>{ pauseUntil = Date.now() + 8000; }, {passive:true}));
    setInterval(()=>{
      if(Date.now() < pauseUntil) return;
      if(row.scrollWidth <= row.clientWidth + 8) return; // not scrollable (desktop grid)
      const card = row.querySelector('.card');
      if(!card) return;
      const step = card.offsetWidth + 14;
      const max = row.scrollWidth - row.clientWidth;
      const next = row.scrollLeft >= max - 8 ? 0 : Math.min(row.scrollLeft + step, max);
      row.scrollTo({left: next, behavior: 'smooth'});
    }, 3000);
  });
}
/* ---- Refresh the catalogue from the shared data source (admin edits) ---- */
function loadCatalogue(){
  if(!(window.MaDube && MaDube.Catalogue && MaDube.Catalogue.loadBooks)) return;
  MaDube.Catalogue.loadBooks().then(books=>{
    if(books && books.length){
      PRODUCTS = books;
      renderProducts();
      renderBookPage();
      renderCart();
      if(typeof initCheckout === 'function') initCheckout();
    }
  }).catch(()=>{});
}

/* ---- Lightweight visit tracking (feeds the admin Analytics section) ---- */
function trackVisit(){
  try{
    localStorage.setItem('madube_visits', String((parseInt(localStorage.getItem('madube_visits')||'0',10)||0)+1));
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const key = isMobile ? 'madube_visits_mobile' : 'madube_visits_desktop';
    localStorage.setItem(key, String((parseInt(localStorage.getItem(key)||'0',10)||0)+1));
  }catch(e){}
}

/* ---- Cookie / storage notice ----
   The site only uses essential local storage (your basket) and loads
   fonts from Google. This banner tells visitors that once, then stays
   dismissed. Choice is remembered in local storage, not a cookie. */
const COOKIE_KEY = 'madube_cookie_ok';
function initCookieNotice(){
  try{ if(localStorage.getItem(COOKIE_KEY)) return; }catch(e){ return; }
  const bar = document.createElement('div');
  bar.className = 'cookie-notice';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie and storage notice');
  bar.innerHTML =
    '<p>We use essential local storage to remember the items in your basket, '
    + 'and load fonts from Google. We do not use advertising or tracking cookies. '
    + 'See our <a href="privacy.html">Privacy Policy</a>.</p>'
    + '<div class="cookie-actions">'
    + '<button class="btn btn-primary" type="button">Got it</button>'
    + '</div>';
  bar.querySelector('button').addEventListener('click', ()=>{
    try{ localStorage.setItem(COOKIE_KEY, '1'); }catch(e){}
    bar.classList.remove('show');
    setTimeout(()=>bar.remove(), 400);
  });
  document.body.appendChild(bar);
  requestAnimationFrame(()=>bar.classList.add('show'));
}

document.addEventListener('DOMContentLoaded', ()=>{
  injectNavCart();
  renderProducts();
  renderBookPage();
  renderCart();
  initBookSliders();
  initCarousel();
  if(typeof initCheckout === 'function') initCheckout();
  trackVisit();
  loadCatalogue();
  initCookieNotice();
});
