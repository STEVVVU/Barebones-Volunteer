const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const { PDFDocument, rgb } = require('pdf-lib');
const { Parser } = require('json2csv');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password12345',
    database: 'VolunteerManagement'
});

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
        let page = pdfDoc.addPage();
        const pageHeight = page.getHeight();
        let y = pageHeight - 50;
        page.drawText('Volunteer Activity Report', { x: 50, y: y, size: 18 });

        y -= 30;
        results.forEach((row, index) => {
            if (y < 50) {
                page = pdfDoc.addPage();
                y = pageHeight - 50;
            }
            page.drawText(`Volunteer: ${row.volunteerName}, Event: ${row.eventName}, Date: ${row.date}`, { x: 50, y: y, size: 12 });
            y -= 20;
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
