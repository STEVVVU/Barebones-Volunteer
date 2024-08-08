const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { Parser } = require('json2csv');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password12345',
    database: 'VolunteerManagement'
});

// Function to split text into lines
function splitTextIntoLines(text, maxWidth, font, fontSize) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
        if (width < maxWidth) {
            currentLine += ` ${word}`;
        } else {
            lines.push(currentLine.trim());
            currentLine = word;
        }
    });
    lines.push(currentLine.trim());
    return lines;
}

// Generate PDF report
router.get('/report/pdf', async (req, res) => {
    const query = `
        SELECT u.email as volunteerName, e.event_name as eventName, v.date
        FROM UserCredentials u
        JOIN VolunteerHistory v ON u.id = v.user_id
        JOIN EventDetails e ON v.event_id = e.event_id
    `;

    db.query(query, async (err, results) => {
        if (err) {
            console.error('Error fetching report data:', err);
            return res.status(500).send('Server error.');
        }

        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const pageWidth = page.getWidth();
        const margin = 50;
        const maxWidth = pageWidth - 2 * margin;
        const fontSize = 12;

        let y = page.getHeight() - 50;
        page.drawText('Volunteer Activity Report', {
            x: margin,
            y: y,
            size: 18,
            font: timesRomanFont,
        });

        y -= 30;
        results.forEach((row) => {
            const text = `Volunteer: ${row.volunteerName}, Event: ${row.eventName}, Date: ${row.date}`;
            const lines = splitTextIntoLines(text, maxWidth, timesRomanFont, fontSize);
            lines.forEach((line) => {
                if (y < 50) {
                    page = pdfDoc.addPage();
                    y = page.getHeight() - 50;
                }
                page.drawText(line, { x: margin, y: y, size: fontSize, font: timesRomanFont });
                y -= 20;
            });
        });

        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes));
    });
});

// Generate CSV report
router.get('/report/csv', (req, res) => {
    const query = `
        SELECT u.email as volunteerName, e.event_name as eventName, v.date
        FROM UserCredentials u
        JOIN VolunteerHistory v ON u.id = v.user_id
        JOIN EventDetails e ON v.event_id = e.event_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching report data:', err);
            return res.status(500).send('Server error.');
        }

        const parser = new Parser();
        const csv = parser.parse(results);

        res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csv);
    });
});

module.exports = router;
