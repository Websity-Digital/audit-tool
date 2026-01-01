const express = require("express");
const cheerio = require("cheerio");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const path = require("path");
require("dotenv").config();

const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* ---------- EMAIL SETUP ---------- */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ---------- ROUTES ---------- */
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/generate-audit", async (req, res) => {
  let browser;

  try {
    const { userName, userEmail, websiteUrl } = req.body;

    /* 1️⃣ Scrape Website */
    const siteRes = await fetch(websiteUrl);
    const html = await siteRes.text();
    const $ = cheerio.load(html);

    const title = $("title").text() || "No Title";
    const description = $('meta[name="description"]').attr("content") || "No Description";
    const h1 = $("h1").first().text() || "No H1";

    /* 2️⃣ Launch Puppeteer (Local vs Railway Auto-Detect) */
    const isLocal = process.platform === "win32"; 
    
    browser = await puppeteer.launch({
      args: isLocal ? [] : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isLocal 
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // Local Windows Path
        : await chromium.executablePath(), // Railway Linux Path
      headless: isLocal ? true : chromium.headless,
    });

    const page = await browser.newPage();

    /* 3️⃣ Generate PDF Content */
    await page.setContent(`
      <div style="font-family:Arial; padding:40px;">
        <h1 style="color:#2563eb;">SEO Audit for ${websiteUrl}</h1>
        <p><strong>Prepared for:</strong> ${userName}</p>
        <hr>
        <h3>Analysis Results:</h3>
        <ul>
          <li><strong>Title Tag:</strong> ${title}</li>
          <li><strong>Meta Description:</strong> ${description}</li>
          <li><strong>H1 Tag:</strong> ${h1}</li>
        </ul>
      </div>
    `);

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    /* 4️⃣ Send Email */
    await transporter.sendMail({
      from: `"SEO Tool" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: "Your SEO Audit Report",
      attachments: [{ filename: "Audit_Report.pdf", content: pdfBuffer }],
    });

    /* 5️⃣ Return PDF to Browser */
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).send("Audit Failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));