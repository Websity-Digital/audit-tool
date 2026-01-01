const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

/* -------------------- ROOT ROUTES (FIXES 502) -------------------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

/* -------------------- EMAIL CONFIG -------------------- */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Gmail address
    pass: process.env.EMAIL_PASS, // Gmail APP PASSWORD
  },
});

/* -------------------- AUDIT ROUTE -------------------- */
app.post('/generate-audit', async (req, res) => {
  const { userName, userEmail, websiteUrl } = req.body;

  try {
    /* 1️⃣ Fetch website safely */
    const response = await axios.get(websiteUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (!response.data) {
      throw new Error('Failed to fetch website HTML');
    }

    const $ = cheerio.load(response.data);
    const title = $('title').text() || 'No title found';

    /* 2️⃣ Launch Chromium (Railway SAFE) */
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

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
          <p><strong>Website:</strong> ${websiteUrl}</p>
          <p><strong>SEO Title:</strong> ${title}</p>
        </body>
      </html>
    `);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    /* 3️⃣ Send email with PDF */
    await transporter.sendMail({
      from: `"SEO Auditor" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Your SEO Audit Report',
      text: `Hi ${userName},

Your SEO audit report is attached.

Regards,
SEO Auditor`,
      attachments: [
        {
          filename: 'SEO_Audit_Report.pdf',
          content: pdfBuffer,
        },
      ],
    });

    /* 4️⃣ Return PDF to browser */
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="SEO_Audit_Report.pdf"'
    );
    res.send(pdfBuffer);

  } catch (error) {
    console.error('AUDIT ERROR:', error);
    res.status(500).send('Audit failed');
  }
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
