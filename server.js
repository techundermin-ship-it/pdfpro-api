const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');
const PDFDocument2 = require('pdfkit');
const rtfToHtml = require('rtf-to-html');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Helper function to clean up uploaded files
const cleanup = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error('Error deleting file:', err);
  });
};

// /split endpoint
app.post('/split', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pagesToInclude = req.body.pages || [0]; // 0-indexed array of page indices
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, pagesToInclude);
    copiedPages.forEach(page => newPdf.addPage(page));
    const newPdfBytes = await newPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="split.pdf"');
    res.send(Buffer.from(newPdfBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /repair endpoint
app.post('/repair', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const repairedBytes = await pdfDoc.save({ useObjectStreams: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="repaired.pdf"');
    res.send(Buffer.from(repairedBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /rotate endpoint
app.post('/rotate', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const angle = req.body.angle || 90; // degrees
    pages.forEach(page => {
      page.setRotation(degrees(angle));
    });
    const rotatedBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rotated.pdf"');
    res.send(Buffer.from(rotatedBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /rtf-to-pdf endpoint
app.post('/rtf-to-pdf', upload.single('rtf'), async (req, res) => {
  try {
    const rtfContent = fs.readFileSync(req.file.path, 'utf8');
    const html = rtfToHtml(rtfContent);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
    res.send(pdfBuffer);
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /txt-to-pdf endpoint
app.post('/txt-to-pdf', upload.single('txt'), async (req, res) => {
  try {
    const text = fs.readFileSync(req.file.path, 'utf8');
    const doc = new PDFDocument2();
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
      res.send(pdfBuffer);
    });
    doc.text(text);
    doc.end();
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /word-to-pdf endpoint
app.post('/word-to-pdf', upload.single('docx'), async (req, res) => {
  try {
    const docxBuffer = fs.readFileSync(req.file.path);
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const html = result.value;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');
    res.send(pdfBuffer);
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /unlock endpoint
app.post('/unlock', upload.single('pdf'), async (req, res) => {
  try {
    const password = req.body.password;
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { password });
    const unlockedBytes = await pdfDoc.save({ useObjectStreams: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="unlocked.pdf"');
    res.send(Buffer.from(unlockedBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /sign endpoint
app.post('/sign', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    firstPage.drawText('Signed', {
      x: 50,
      y: 50,
      size: 30,
      color: rgb(0, 0, 0),
    });
    const signedBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="signed.pdf"');
    res.send(Buffer.from(signedBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// /watermark endpoint
app.post('/watermark', upload.single('pdf'), async (req, res) => {
  try {
    const watermarkText = req.body.text || 'Watermark';
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 2 - 100,
        y: height / 2,
        size: 50,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.5,
      });
    });
    const watermarkedBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="watermarked.pdf"');
    res.send(Buffer.from(watermarkedBytes));
    cleanup(req.file.path);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});