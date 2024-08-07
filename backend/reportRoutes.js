const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { createObjectCsvWriter } = require('csv-writer');
const db = require('./db'); // Ensure this path is correct

const router = express.Router();

// Route to generate PDF report
router.get('/report/pdf', async (req, res) => {
  try {
    console.log("Starting PDF generation process");
    db.query(`
      SELECT u.email as volunteerName, e.event_name as eventName, v.participation_date as date
      FROM usercredentials u
      JOIN volunteerhistory v ON u.id = v.user_id
      JOIN eventdetails e ON v.event_id = e.event_id
    `, async (error, results) => {
      if (error) {
        console.error("Database query error:", error);
        return res.status(500).send('Error generating PDF report');
      }

      console.log("Query results:", results); // Log the query results

      if (results.length === 0) {
        console.log("No data found for the PDF report");
        return res.status(404).send('No data found for the PDF report');
      }

      try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        let y = height - 40;

        page.drawText('Volunteer Report', { x: 30, y, size: 20 });
        y -= 20;

        results.forEach(volunteer => {
          console.log(`Adding volunteer: ${volunteer.volunteerName}`);
          page.drawText(`Volunteer: ${volunteer.volunteerName}`, { x: 30, y, size: 15 });
          y -= 20;
          page.drawText(`Event: ${volunteer.eventName}, Date: ${volunteer.date}`, { x: 50, y, size: 12 });
          y -= 15;
        });

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
        res.send(Buffer.from(pdfBytes));
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
        return res.status(500).send('Error generating PDF report');
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send('Error generating PDF report');
  }
});

// Route to generate CSV report
router.get('/report/csv', async (req, res) => {
  try {
    console.log("Starting CSV generation process");
    db.query(`
      SELECT u.email as volunteerName, e.event_name as eventName, v.participation_date as date
      FROM usercredentials u
      JOIN volunteerhistory v ON u.id = v.user_id
      JOIN eventdetails e ON v.event_id = e.event_id
    `, (error, results) => {
      if (error) {
        console.error("Database query error:", error);
        return res.status(500).send('Error generating CSV report');
      }

      console.log("Query results:", results); // Log the query results

      if (results.length === 0) {
        console.log("No data found for the CSV report");
        return res.status(404).send('No data found for the CSV report');
      }

      try {
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
              console.error("CSV download error:", err);
            }
          });
        });
      } catch (csvError) {
        console.error("CSV generation error:", csvError);
        return res.status(500).send('Error generating CSV report');
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).send('Error generating CSV report');
  }
});

module.exports = router;
