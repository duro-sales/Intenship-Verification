# DURO Automation — Internship Certificate Verification Portal

A secure web app where anyone can verify a DURO internship certificate by its reference ID,
see the internship period, and download the original PDF. Includes an OTP-protected admin console.

## Quick start

```bash
cd Internship
npm install
cp .env.example .env      # then edit .env (see "Email" below)
npm start
```

- Public portal: http://localhost:3000
- Admin console: http://localhost:3000/admin (sign in with **sales@duroautomation.com**)

Requires **Node.js 22.13 or newer** (uses the built-in SQLite engine — no database server needed).

On first start the 21 interns from the 2025 and 2026 rosters are imported automatically.

## Email (OTP sign-in)

Fill in `SMTP_*` in `.env`. Until SMTP is configured (development only), sign-in codes are printed in
the server console. In `NODE_ENV=production` SMTP is required.

| Provider | SMTP_HOST | SMTP_PORT | Password |
|---|---|---|---|
| Google Workspace / Gmail | smtp.gmail.com | 465 | App Password (needs 2-Step Verification) |
| Zoho Mail | smtp.zoho.in | 465 | Account / app password |
| Microsoft 365 | smtp.office365.com | 587 | Account password (SMTP AUTH enabled) |

## Features

**Public portal**
- Verify by Certificate / Intern ID (format `DURO-INT-XX-XXX-XXX`: batch year – location code – intern number), with a shareable link `/verify/<ID>`
- Shows name, branch, batch, status, domain, start/end dates and duration
- View / download the certificate PDF
- **Verify a document**: an employer uploads the file (PDF, PNG or JPG) they received; it's matched byte-for-byte (SHA-256)
  against the original, so any edited or forged PDF fails. Uploaded files are not stored.
- QR code linking to the verification page
- Discontinued / Disqualified interns are shown as "Not Completed — no certificate issued", and
  their certificates can't be downloaded

**Admin console**
- Email + 6-digit OTP sign-in (10-minute expiry, 5 attempts, 60-second resend cooldown)
- Add, edit and delete interns; IDs are generated automatically in the DURO-INT-YY-CHN-NNN series
- Upload, replace, preview and remove certificates (PDF, PNG or JPG) — from the table or inside the Add/Edit form
- Search and filter; export to CSV; download a QR code for each intern
- Admin members (owner only): add people as **Admin** (full edit) or **Viewer** (read only), suspend
  or remove them
- Activity log of every sign-in and change

## Security
- Passwordless OTP login; codes are stored only as HMAC hashes and compared in constant time
- Session cookies are HttpOnly, SameSite=Strict, and Secure plus `__Host-` in production; 8-hour expiry
- CSRF protection (custom header + Origin check), strict Content-Security-Policy, HSTS (via Helmet)
- Rate limits on verification, downloads, document checks and login
- Certificate files are stored outside the web root under random names; uploads must be real PDF, PNG or JPG files (checked by file signature, ≤10 MB)
- All SQL is parameterised; all output is HTML-escaped; CSV export blocks formula injection
- Unknown emails get the same login response as real admins, so admin accounts can't be discovered

## Deploying to production
1. Run on a server or VPS with Node 22.13+ (for example behind nginx with HTTPS from Let's Encrypt).
2. In `.env`, set `NODE_ENV=production`, `PUBLIC_URL=https://verify.duroautomation.com` (your domain),
   your SMTP details, and `TRUST_PROXY=1` when behind nginx.
3. Keep the app running with `pm2 start npm --name duro-portal -- start` (or systemd).
4. **Back up the `data/` folder** regularly — it holds the database and all certificate PDFs.

nginx needs `client_max_body_size 12m;` and `proxy_set_header Host $host;`.

## Project layout
```
server.js              app entry, security headers, routing
src/config.js          settings (branches, statuses, limits)
src/db.js              SQLite schema + initial roster
src/auth.js            sessions, OTP hashing, CSRF guard
src/interns.js         validation, verdict logic, file storage
src/routes/            public, auth and admin APIs
public/                HTML, CSS, JS, logo
data/                  database + certificates (created automatically, git-ignored)
```
