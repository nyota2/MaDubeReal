/* ============================================================
   MaDube Books - cart + storefront logic (no build tools)
   ============================================================ */

/* ---- Product catalogue (edit prices / add books here) ----
   `img` points to the real cover in assets/covers/. If a product has
   no image yet, a typographic cover is generated from kicker/title/sub. */
const PRODUCTS = [
  { id:'inombolo-nd', title:'Inombolo - Numbers Workbook', lang:'isiNdebele', type:'Activity Book',
    age:'Ages 3–6', price:6.00, cover:'cv-red', img:'assets/covers/inombolo-ndebele.jpg',
    kicker:'Ugwalo Lomsebenzi', sub:'owenziwa ekhaya', format:'Softcover workbook',
    desc:'Fun homework workbook that introduces numbers 1–10 through African play and counting.',
    summary:'Inombolo turns learning numbers 1–10 into playtime! Written entirely in isiNdebele, this homework workbook is filled with counting games, tracing practice and colouring activities rooted in everyday African life. Children count animals, market fruits and household objects they recognise, building number confidence while growing strong in their home language. Perfect for pre-schoolers working at home with a parent, gogo or older sibling.' },
  { id:'abc-shona', title:'abc chiShona - Writing Workbook', lang:'Shona', type:'Early Reader',
    age:'Ages 3–6', price:6.00, cover:'cv-teal', img:'assets/covers/abc-chishona.jpg',
    kicker:'Zvinyorwa', sub:'zvekuitira kumba', format:'Softcover workbook',
    desc:'Learn to write the Shona alphabet at home with tracing, colouring and letter games.',
    summary:'Learn to write the Shona alphabet the fun way! Each letter comes with tracing lines, a heritage-themed picture to colour, and a familiar Shona word to say out loud. Designed for little hands taking their first steps in writing, abc chiShona builds pencil control and letter recognition while celebrating the language children hear at home. A joyful first step towards reading and writing in Shona.' },
  { id:'zella-shona', title:'Zella Matoo-too - Busy Book', lang:'Shona & English', type:'Busy Book',
    age:'Ages 6+', price:5.00, cover:'cv-gold', img:'assets/covers/zella-shona.jpg',
    kicker:'6+ Busy Book', sub:'Puzzles • Spot the difference • Colouring', format:'Softcover activity book, 50+ pages',
    desc:'50+ pages of activities featuring the MaDube animal cast: spot 5 differences, colour, solve.',
    summary:'Meet Zella Matoo-too and the whole MaDube animal cast (Lion, Elephant, Crocodile, Baboon and Rabbit) in over 50 pages of puzzles, spot-the-difference challenges, colouring and problem-solving fun. Presented in Shona and English side by side, every activity sneaks in a little language learning while children play. Ideal for road trips, rainy afternoons and school holidays.' },
  { id:'zella-ndebele', title:'Zella Matoo-too - Busy Book', lang:'isiNdebele & English', type:'Busy Book',
    age:'Ages 6+', price:5.00, cover:'cv-green', img:'assets/covers/busybook-ndebele.jpg',
    kicker:'6+ Busy Book', sub:'Imisebenzi • Imehluko emihlanu', format:'Softcover activity book, 50+ pages',
    desc:'Bilingual busy book packed with games, arts & crafts and problem-solving fun.',
    summary:'The isiNdebele edition of our best-loved busy book! Zella Matoo-too and the animal friends lead children through games, arts and crafts, mazes and imehluko emihlanu (spot 5 differences), all in isiNdebele and English side by side. Every page keeps hands busy and minds growing, making heritage language practice feel like pure play. A favourite for ages 6 and up.' },
  { id:'inombolo-eng', title:'Numbers - English Workbook', lang:'English', type:'Activity Book',
    age:'Ages 3–6', price:6.00, cover:'cv-purple', format:'Softcover workbook',
    kicker:'Home Workbook', sub:'Count • Trace • Colour',
    desc:'The English edition of our numbers workbook for early counting and number formation.',
    summary:'The English edition of our numbers workbook brings counting to life with African play. Children count, trace and colour their way from 1 to 10 alongside beautiful heritage-themed illustrations: baobab trees, market stalls and the animals of the MaDube world. Each number gets its own practice pages for correct formation, making this the perfect at-home companion for early maths.' },
  { id:'abc-eng', title:'abc English - Writing Workbook', lang:'English', type:'Early Reader',
    age:'Ages 3–6', price:6.00, cover:'cv-red', img:'assets/covers/abc-english.jpg',
    kicker:'Home Workbook', sub:'Trace • Write • Play', format:'Softcover workbook',
    desc:'Practice the English alphabet with heritage-themed illustrations and tracing activities.',
    summary:'Practice the English alphabet from A to Z with tracing, writing and play! Every letter is paired with a heritage-themed illustration to colour and a word to sound out, so children connect new letters to the world around them. Clear tracing guides help little hands form each letter correctly, building the confidence they need for school. A warm, African take on the classic ABC workbook.' },
];

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
          <div class="tags"><span class="tag">${p.type}</span><span class="tag lang">${p.lang}</span></div>
          <h3><a href="book.html?id=${p.id}">${p.title.split(' - ')[1] ? p.title.split(' - ')[1].trim() : p.title}</a></h3>
          <p class="desc">${p.desc}</p>
          <div class="price-row">
            <span class="price">${money(p.price)}</span>
            <button class="add" onclick="addToCart('${p.id}')">Add to cart +</button>
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
        <div class="tags"><span class="tag">${p.type}</span><span class="tag lang">${p.lang}</span><span class="tag age">${p.age}</span></div>
        <h1>${p.title}</h1>
        <div class="bd-price">${money(p.price)}</div>
        <p class="bd-summary">${p.summary || p.desc}</p>
        <ul class="bd-facts">
          <li><strong>Language</strong>${p.lang}</li>
          <li><strong>Age range</strong>${p.age}</li>
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
        <p class="placeholder-note"><strong>Schools &amp; bulk buyers:</strong> print on demand from US$2.50 per copy for 50+ copies. <a href="contact.html" style="color:var(--red);font-weight:800">Get a quote →</a></p>
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
document.addEventListener('DOMContentLoaded', ()=>{
  renderProducts();
  renderBookPage();
  renderCart();
  initCarousel();
  if(typeof initCheckout === 'function') initCheckout();
});
