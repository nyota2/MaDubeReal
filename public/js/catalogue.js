/* ============================================================
   MaDube Books - shared catalogue
   ------------------------------------------------------------
   Single source of truth for books + categories, used by BOTH
   the storefront (js/main.js) and the admin dashboard (js/admin.js).
   loadBooks() returns saved books from MaDube.DB when any exist,
   otherwise the built-in defaults below, so the site always has
   content even before anything is added in the dashboard.
   ============================================================ */

window.MaDube = window.MaDube || {};

MaDube.Catalogue = (function () {

  /* Built-in starter catalogue (was the hard-coded list in main.js).
     Books with a real cover file use img:; the rest fall back to a
     coloured typographic cover until their image is added. */
  var DEFAULT_BOOKS = [
    { id:'num-inombolo-nd', title:'Inombolo - Numbers Workbook', author:'Eve Tendai', lang:'isiNdebele', type:'Activity Book',
      age:'Ages 3-6', price:6.00, cover:'cv-red', img:'assets/covers/inombolo-ndebele.jpg',
      kicker:'Ugwalo lomsebenzi', sub:'owenziwa ekhaya', format:'Softcover workbook', status:'published', categoryId:'cat-activity',
      desc:'A playful numbers workbook in isiNdebele for little counters aged 3 to 6.',
      summary:'Counting is so much fun with Inombolo! Little ones trace, count and colour their way through friendly numbers, all in isiNdebele. Every page is full of happy animals and pictures to keep small hands busy. A lovely first numbers book to share at home with mom, dad or gogo.' },
    { id:'abc-write-sn', title:'abc chiShona - Writing Workbook', author:'Eve Tendai', lang:'Shona', type:'Early Reader',
      age:'Ages 3-6', price:6.00, cover:'cv-teal', img:'assets/covers/abc-chishona.jpg',
      kicker:'Zvinyorwa', sub:'zvekuitira kumba', format:'Softcover workbook', status:'published', categoryId:'cat-early-reader',
      desc:'Learn to write the Shona alphabet at home with tracing and colouring.',
      summary:'Learn to write your letters the fun way in Shona! abc chiShona is packed with tracing lines, pictures to colour and happy words to say out loud. Little hands build the skills they need for big-kid writing. A joyful first step into reading and writing, ages 3 to 6.' },
    { id:'abc-write-en', title:'abc English - Writing Workbook', author:'Eve Tendai', lang:'English', type:'Early Reader',
      age:'Ages 3-6', price:6.00, cover:'cv-red', img:'assets/covers/abc-english.jpg',
      kicker:'Home Workbook', sub:'Trace - Write - Play', format:'Softcover workbook', status:'published', categoryId:'cat-early-reader',
      desc:'Practice the English alphabet with tracing, writing and fun pictures.',
      summary:'Say hello to A, B, C! This friendly English workbook helps little ones trace and write every letter with fun pictures to colour along the way. Each page builds confidence for school, one letter at a time. A happy home helper for ages 3 to 6.' },
    { id:'busy-zella-sn', title:'Zella Matoo-too - Busy Book', lang:'Shona & English', type:'Busy Book',
      age:'Ages 6+', price:5.00, cover:'cv-gold', img:'assets/covers/zella-shona.jpg',
      kicker:'6+ Busy Book', sub:'Puzzles - Colouring - Games', format:'Softcover activity book, 50+ pages', status:'published', categoryId:'cat-busy',
      desc:'50+ pages of puzzles, colouring and games with the MaDube animal cast.',
      summary:'Meet Zella Matoo-too and all her animal friends! This busy book is bursting with puzzles, spot the difference, colouring and games in Shona and English. Every page keeps little hands busy and minds growing. Perfect for road trips, rainy days and holidays, ages 6 and up.' },
    { id:'busy-zella-nd', title:'Zella Matoo-too - Busy Book', lang:'isiNdebele & English', type:'Busy Book',
      age:'Ages 6+', price:5.00, cover:'cv-green', img:'assets/covers/busybook-ndebele.jpg',
      kicker:'6+ Busy Book', sub:'Imisebenzi - Imehluko emihlanu', format:'Softcover activity book, 50+ pages', status:'published', categoryId:'cat-busy',
      desc:'The isiNdebele and English busy book full of puzzles, games and colouring.',
      summary:'The isiNdebele and English busy book full of fun! Join Zella and the animal cast for puzzles, imehluko emihlanu (spot five differences), colouring and games. Loads of pages to keep children happy and learning. A holiday favourite for ages 6 and up.' }
  ];

  var DEFAULT_CATEGORIES = [
    { id:'cat-early-reader', name:'Early Readers',  description:'First steps in reading and writing', icon:'', color:'#7EC8E3' },
    { id:'cat-activity',     name:'Activity Books', description:'Counting, tracing and number play',  icon:'', color:'#F4A259' },
    { id:'cat-colouring',    name:'Colouring Books', description:'Crayons, letters and happy pictures', icon:'', color:'#B0405A' },
    { id:'cat-busy',         name:'Busy Books',     description:'Puzzles, games and problem solving',  icon:'', color:'#8AB17D' }
  ];

  var COVER_FALLBACKS = ['cv-teal', 'cv-red', 'cv-gold', 'cv-green', 'cv-purple'];

  /* Turn any stored/admin book into the shape the storefront renders. */
  function normalize(b, i) {
    var ageGroup = b.ageGroup || '';
    var age = b.age || (ageGroup ? ('Ages ' + ageGroup) : '');
    var type = b.type || b.categoryName || 'Book';
    var img = b.img || b.coverImage || b.coverUrl || '';
    return {
      id: b.id,
      title: b.title || 'Untitled',
      author: b.author || '',
      lang: b.lang || '',
      type: type,
      age: age,
      price: Number(b.price) || 0,
      img: img,
      cover: b.cover || COVER_FALLBACKS[i % COVER_FALLBACKS.length],
      kicker: b.kicker || type,
      sub: b.sub || '',
      format: b.format || '',
      desc: b.desc || (b.summary ? b.summary.slice(0, 140) : ''),
      summary: b.summary || b.desc || '',
      status: b.status || 'published',
      categoryId: b.categoryId || ''
    };
  }

  /* Storefront view: only published books, normalized. */
  function loadBooks() {
    if (!MaDube.DB) return Promise.resolve(DEFAULT_BOOKS.slice());
    return MaDube.DB.list('books').then(function (rows) {
      var source = (rows && rows.length) ? rows : DEFAULT_BOOKS;
      return source
        .map(normalize)
        .filter(function (b) { return b.status !== 'draft'; });
    }).catch(function (err) {
      console.warn('[MaDube] loadBooks failed, using defaults:', err);
      return DEFAULT_BOOKS.slice();
    });
  }

  return {
    DEFAULT_BOOKS: DEFAULT_BOOKS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    normalize: normalize,
    loadBooks: loadBooks
  };
})();
