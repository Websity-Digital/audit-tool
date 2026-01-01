const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const path = require('path');

const puppeteer = require('puppeteer'); // LOCAL + PROD SAFE

require('dotenv').config();

const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

/* ---------- EMAIL ---------- */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ---------- ROUTES ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate-audit', async (req, res) => {
  const { userName, userEmail, websiteUrl } = req.body;

  try {
    const response = await axios.get(websiteUrl, { timeout: 15000 });
    const $ = cheerio.load(response.data);

    const title = $('title').text() || 'No title found';
    const h1 = $('h1').first().text() || 'No H1 found';

    /* 🚨 RAILWAY DETECTION */
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    if (isRailway) {
      // 🔁 TEMP SAFE RESPONSE (Railway)
      return res.send(`
        <h2>Audit Generated</h2>
        <p><strong>Website:</strong> ${websiteUrl}</p>
        <p><strong>SEO Title:</strong> ${title}</p>
        <p><strong>Main H1:</strong> ${h1}</p>
        <p>PDF generation is disabled on Railway runtime.</p>
      `);
    }

    /* ✅ LOCAL PUPPETEER */
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setContent(
      `<h1>SEO Audit</h1><p>${title}</p><p>${h1}</p>`,
      { waitUntil: 'networkidle0' }
    );

    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).send('Audit failed');
  }
});


/* ---------- SERVER ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/`);
});
