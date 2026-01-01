const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Add this at the very top

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- EMAIL CONFIGURATION ---
// Update the transporter section:
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
        console.log(`Starting audit for ${websiteUrl}...`);

        // 1. Scrape Data
        const response = await axios.get(websiteUrl);
        const $ = cheerio.load(response.data);
        const title = $('title').text() || "No Title Found";

        // 2. Generate PDF with Puppeteer
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        const htmlContent = `
            <div style="font-family: Arial; padding: 40px;">
                <h1 style="color: #2563eb;">SEO Audit Report</h1>
                <p>Hello ${userName}, here is your report for ${websiteUrl}</p>
                <div style="border: 1px solid #ddd; padding: 20px;">
                    <p><b>SEO Title:</b> ${title}</p>
                </div>
            </div>`;
        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        // 3. Send Email in the Background
        const mailOptions = {
            from: '"SEO Tool" <your-email@gmail.com>',
            to: userEmail,
            subject: 'Your Website SEO Audit Report',
            text: `Hi ${userName},\n\nThank you for using our tool! Please find your SEO audit report for ${websiteUrl} attached.\n\nBest regards,\nSEO Team`,
            attachments: [
                {
                    filename: 'SEO_Audit_Report.pdf',
                    content: pdfBuffer
                }
            ]
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log("Email Error: ", err);
            else console.log("Email sent: " + info.response);
        });

        // 4. Send PDF to Browser (Opens in New Tab)
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));