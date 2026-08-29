# MOTH EMPIRE brand site (sim is a toy)

Brand-first page. Waitlist is the product action. Paper trading sits at the bottom on purpose.

## Files
- `index.html` — shop / lookbook / waitlist / toy sim
- `emails.js` — save emails on-device + CSV export helper
- `emails.html` — list viewer / export / clear
- `sim.js` — fake $10k vs CoinGecko
- `game.html` — character creator game (moved off the homepage)

## Emails
Signups write to `localStorage` key `moth_waitlist_v1`.
Open `emails.html` on the same browser → Export CSV.

To also send off-device, create a Formspree form and in `index.html` before the scripts add:

```html
<script>window.MOTH_FORMSPREE = 'https://formspree.io/f/YOUR_ID';</script>
```

## Deploy
Pushed to mothworldwideinfo/supreme-empire on main.
Unpause the Vercel project if production still shows DEPLOYMENT_DISABLED.
