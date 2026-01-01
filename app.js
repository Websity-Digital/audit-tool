const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post('/generate-audit', async (req, res) => {
    const { userName, userEmail, websiteUrl } = req.body;

    try {
        // 1. Scrape the website
        const response = await axios.get(websiteUrl);
        const $ = cheerio.load(response.data);
        const title = $('title').text() || "No Title Found";
        const h1 = $('h1').first().text() || "No H1 Found";

        // 2. Start Puppeteer
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();

        // 3. Create the HTML for the PDF
        const htmlContent = `
            <div style="padding: 50px; font-family: Arial;">
                <h1 style="color: #2563eb;">SEO Report for ${userName}</h1>
                <p><b>Email:</b> ${userEmail}</p>
                <p><b>Website:</b> ${websiteUrl}</p>
                <hr>
                <h3>Analysis:</h3>
                <p><b>SEO Title:</b> ${title}</p>
                <p><b>Main Heading:</b> ${h1}</p>
                <p>Status: Audit Completed Successfully.</p>
            </div>
        `;

        await page.setContent(htmlContent);
        
        // 4. Generate PDF buffer (don't save to disk, send to browser)
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

        await browser.close();

        // 5. Send PDF to browser to open in new tab
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (error) {
        res.status(500).send("Error generating audit: " + error.message);
    }
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});