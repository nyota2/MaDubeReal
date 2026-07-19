# MaDube Books - Website

A static, African-themed online bookstore for MaDube Books. No build tools required - just open the files or upload them to any web host.

## View it locally
Double-click **`index.html`** to open it in your browser. That's it.

(Optional, nicer preview with working paths: run a tiny local server in this folder - `python -m http.server` - then visit `http://localhost:8000`.)

## Pages
| File | Page |
|------|------|
| `index.html` | Home |
| `shop.html` | All books |
| `about.html` | About the company |
| `contact.html` | Contact + message form |
| `checkout.html` | Basket checkout (card **or** hard-copy delivery) |

## How the shop works
- Books live in one place: **`js/main.js`** → the `PRODUCTS` list. Edit titles, prices, languages there.
- The basket is saved in the visitor's browser (localStorage). Cart, quantities and checkout all work already.
- Checkout offers two paths, exactly as you asked:
  1. **Digital / Pay by card** - card form (number, expiry, CVV, account reference).
  2. **Hard copy delivery** - collects name, phone, location/address and delivery notes.

## Things to do before going live
1. **Logo** - done. The real zebra logo lives at `assets/logo.jpg` (used in the header, footer, favicon and hero). For crisper results on coloured backgrounds, swap in a transparent-background PNG with the same filename idea and update the `<img>` tags.
2. **Real book covers** - the covers are styled placeholders right now. To use photos, drop images in `assets/images/` and swap the `coverHTML()` output in `js/main.js` for `<img>` tags.
3. **Payments** - the card form is a working *display* only; no money is taken yet. Connect the payment block in `checkout.html` to **Stripe**, **PayPal**, or a local gateway (EcoCash / bank) so real payments process.
4. **Orders & contact form** - orders are currently saved in the browser only. Wire the checkout + contact form to your email or a form service (e.g. Formspree) so you actually receive them.
5. **Admin dashboard** - planned for later, as discussed.

## Colours & African style
All colours and the African patterns (Ndebele triangle band, mudcloth texture, Kente zigzag) are defined in **`css/style.css`** at the top (`:root`). Change them in one place to restyle the whole site.
