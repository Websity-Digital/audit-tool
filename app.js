const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const chromium = require('chromium');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Add this at the very top

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});



app.post('/generate-audit', async (req, res) => {
  const { userName, userEmail, websiteUrl } = req.body;

  try {
    const response = await axios.get(websiteUrl);
    const $ = cheerio.load(response.data);
    const title = $('title').text() || 'No Title Found';

    const browser = await puppeteer.launch({
      executablePath: chromium.path,
      args: chromium.args,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(`
      <html>
        <body style="font-family: Arial; padding:40px">
          <h1 style="color:#2563eb">SEO Audit Report</h1>
          <p>Hello ${userName}</p>
          <p><b>Website:</b> ${websiteUrl}</p>
          <p><b>SEO Title:</b> ${title}</p>
        </body>
      </html>
    `);

    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    await transporter.sendMail({
      from: `"SEO Auditor" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Your SEO Audit Report',
      attachments: [{ filename: 'SEO_Audit_Report.pdf', content: pdfBuffer }]
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="SEO_Audit_Report.pdf"');
    res.send(pdfBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).send('Audit failed');
  }
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));