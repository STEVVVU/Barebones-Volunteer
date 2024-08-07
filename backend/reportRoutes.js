const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { createObjectCsvWriter } = require('csv-writer');
const db = require('./db'); // Path to db.js

const router = express.Router();

// Route to generate PDF report
router.get('/report/pdf', async (req, res) => {
  try {
    const [volunteers] = await db.query(`
      SELECT v.name as volunteerName, e.name as eventName, p.date
      FROM volunteers v
      JOIN participations p ON v.id = p.volunteer_id
      JOIN events e ON p.event_id = e.id
    `);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let y = height - 40;

    page.drawText('Volunteer Report', { x: 30, y, size: 20 });
    y -= 20;

    volunteers.forEach(volunteer => {
      page.drawText(`Volunteer: ${volunteer.volunteerName}`, { x: 30, y, size: 15 });
      y -= 20;
      page.drawText(`Event: ${volunteer.eventName}, Date: ${volunteer.date}`, { x: 50, y, size: 12 });
      y -= 15;
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating PDF report');
  }
});

// Route to generate CSV report
router.get('/report/csv', async (req, res) => {
  try {
    const [volunteers] = await db.query(`
      SELECT v.name as volunteerName, e.name as eventName, p.date
      FROM volunteers v
      JOIN participations p ON v.id = p.volunteer_id
      JOIN events e ON p.event_id = e.id
    `);

    const data = volunteers.map(volunteer => ({
      Volunteer: volunteer.volunteerName,
      Event: volunteer.eventName,
      Date: volunteer.date
    }));

    const csvWriter = createObjectCsvWriter({
      path: 'volunteer_report.csv',
      header: [
        { id: 'Volunteer', title: 'Volunteer' },
        { id: 'Event', title: 'Event' },
        { id: 'Date', title: 'Date' }
      ]
    });

    await csvWriter.writeRecords(data);
    res.download('volunteer_report.csv', 'volunteer_report.csv', err => {
      if (err) {
        console.error(err);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating CSV report');
  }
});

module.exports = router;
