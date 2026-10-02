'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const config = require('./src/config');
require('./src/db');
const { csrfGuard, getSessionAdmin } = require('./src/auth');
const { smtpConfigured, verifySmtp } = require('./src/mailer');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'upgrade-insecure-requests': config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

app.use(express.json({ limit: '50kb' }));

// ---------- API ----------
app.use('/api', csrfGuard);
app.use('/api', require('./src/routes/public'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- Pages ----------
const page = (file) => path.join(config.PUBLIC_DIR, file);
const noStore = (res) => res.set('Cache-Control', 'no-store');

app.get(['/', '/verify', '/verify/:id'], (req, res) => res.sendFile(page('index.html')));

app.get(['/admin/login', '/admin/login/'], (req, res) => {
  noStore(res);
  if (getSessionAdmin(req)) return res.redirect('/admin');
  res.sendFile(page('admin/login.html'));
});
app.get(['/admin', '/admin/'], (req, res) => {
  noStore(res);
  if (!getSessionAdmin(req)) return res.redirect('/admin/login');
  res.sendFile(page('admin/index.html'));
});
// Block direct access to the raw admin HTML files.
app.use('/admin', (req, res, next) => (/\.html?$/i.test(req.path) ? res.redirect('/admin') : next()));

app.use(
  express.static(config.PUBLIC_DIR, {
    index: false,
    maxAge: config.isProduction ? '1d' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.set('Cache-Control', 'no-store');
    },
  })
);

app.use((req, res) => res.status(404).sendFile(page('404.html')));

// ---------- Errors ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  if (err.expose && err.status) return res.status(err.status).json({ error: err.message });
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(config.port, config.host, async () => {
  console.log(`\n  DURO Internship Portal running`);
  console.log(`  ▸ Public verification : ${config.publicUrl}/`);
  console.log(`  ▸ Admin console       : ${config.publicUrl}/admin`);
  console.log(`  ▸ Owner account       : ${config.ownerEmail}`);
  if (!smtpConfigured) {
    console.log(`  ▸ Email               : NOT CONFIGURED — OTP codes will be printed here (dev mode)\n`);
  } else {
    const ok = await verifySmtp();
    console.log(`  ▸ Email               : ${ok ? 'SMTP connected' : 'SMTP connection FAILED — check .env'}\n`);
  }
});
