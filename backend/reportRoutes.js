const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { createObjectCsvWriter } = require('csv-writer');
const db = require('./db'); // Path to db.js

const router = express.Router();

// Route to generate PDF report
router.get('/report/pdf', async (req, res) => {
  try {
    db.query(`
      SELECT u.email as volunteerName, e.event_name as eventName, v.date
      FROM usercredentials u
      JOIN volunteerhistory v ON u.id = v.user_id
      JOIN eventdetails e ON v.event_id = e.event_id
    `, async (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Error generating PDF report');
      }

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      let y = height - 40;

      page.drawText('Volunteer Report', { x: 30, y, size: 20 });
      y -= 20;

      results.forEach(volunteer => {
        page.drawText(`Volunteer: ${volunteer.volunteerName}`, { x: 30, y, size: 15 });
        y -= 20;
        page.drawText(`Event: ${volunteer.eventName}, Date: ${volunteer.date}`, { x: 50, y, size: 12 });
        y -= 15;
      });

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
      res.send(Buffer.from(pdfBytes));
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating PDF report');
  }
});

// Route to generate CSV report
router.get('/report/csv', async (req, res) => {
  try {
    db.query(`
      SELECT u.email as volunteerName, e.event_name as eventName, v.date
      FROM usercredentials u
      JOIN volunteerhistory v ON u.id = v.user_id
      JOIN eventdetails e ON v.event_id = e.event_id
    `, (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Error generating CSV report');
      }

      const data = results.map(volunteer => ({
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

      csvWriter.writeRecords(data).then(() => {
        res.download('volunteer_report.csv', 'volunteer_report.csv', err => {
          if (err) {
            console.error(err);
          }
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating CSV report');
  }
});

module.exports = router;
