require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Email Transporter using variables from Railway
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/generate-audit', async (req, res) => {
    const { userName, userEmail, websiteUrl } = req.body;

    try {
        console.log(`Auditing: ${websiteUrl}`);

        // 1. Scraping
        const { data } = await axios.get(websiteUrl);
        const $ = cheerio.load(data);
        const seoTitle = $('title').text() || "Missing Title";

        // 2. Puppeteer (Optimized for Railway/Linux)
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        const htmlReport = `
            <div style="font-family: Arial; padding: 40px;">
                <h1 style="color: #2563eb;">SEO Report for ${userName}</h1>
                <p>Website: ${websiteUrl}</p>
                <hr>
                <p><b>SEO Title:</b> ${seoTitle}</p>
            </div>`;

        await page.setContent(htmlReport);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        // 3. Emailing
        const mailOptions = {
            from: `"SEO Auditor" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: 'Your SEO Audit Result',
            text: `Hi ${userName}, please find your audit attached.`,
            attachments: [{ filename: 'Audit.pdf', content: pdfBuffer }]
        };

        transporter.sendMail(mailOptions);

        // 4. Respond to Browser
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});

app.listen(PORT, () => console.log(`Live on port ${PORT}`));