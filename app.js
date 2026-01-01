const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const puppeteer = require('puppeteer');           // Local dev
const puppeteerCore = require('puppeteer-core');  // Production
const chromium = require('@sparticuz/chromium');

const path = require('path');
require('dotenv').config();

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

/* ---------------- ROUTES ---------------- */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate-audit', async (req, res) => {
  const { userName, userEmail, websiteUrl } = req.body;

  let browser;

  try {
    /* 1️⃣ Fetch website */
    const response = await axios.get(websiteUrl, { timeout: 10000 });
    const $ = cheerio.load(response.data);

    const title = $('title').text() || 'No Title Found';
    const h1 = $('h1').first().text() || 'No H1 Found';

    /* 2️⃣ Launch Puppeteer (ENV AWARE) */
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      // 🚀 Railway / Linux
      browser = await puppeteerCore.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // 💻 Local Windows / Mac
      browser = await puppeteer.launch({
        headless: true,
      });
    }

    const page = await browser.newPage();

    /* 3️⃣ Build PDF HTML */
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>SEO Audit</title>
        </head>
        <body style="font-family: Arial; padding: 40px;">
          <h1 style="color:#2563eb;">SEO Audit Report</h1>
          <hr />
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Website:</strong> ${websiteUrl}</p>
          <h3>Analysis</h3>
          <p><strong>SEO Title:</strong> ${title}</p>
          <p><strong>Main H1:</strong> ${h1}</p>
          <p>Status: Audit completed successfully.</p>
        </body>
      </html>
    `);

    /* 4️⃣ Generate PDF */
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    /* 5️⃣ Return PDF */
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="SEO_Audit_Report.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    if (browser) await browser.close();
    console.error('Audit error:', error);
    res.status(500).send('Error generating audit');
  }
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
