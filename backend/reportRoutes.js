const express = require('express');
const { PDFDocument, rgb } = require('pdf-lib');
const { createObjectCsvWriter } = require('csv-writer');
const Volunteer = require('./models/Volunteer'); // Adjust the path based on your actual models
const Event = require('./models/Event'); // Adjust the path based on your actual models

const router = express.Router();

// Route to generate PDF report
router.get('/report/pdf', async (req, res) => {
  const volunteers = await Volunteer.find().populate('participations'); // Adjust the query based on your schema
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let y = height - 40;

  page.drawText('Volunteer Report', { x: 30, y, size: 20 });
  y -= 20;

  volunteers.forEach(volunteer => {
    page.drawText(`Volunteer: ${volunteer.name}`, { x: 30, y, size: 15 });
    y -= 20;
    volunteer.participations.forEach(participation => {
      page.drawText(`Event: ${participation.event.name}, Date: ${participation.date}`, { x: 50, y, size: 12 });
      y -= 15;
    });
  });

  const pdfBytes = await pdfDoc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=volunteer_report.pdf');
  res.send(Buffer.from(pdfBytes));
});

// Route to generate CSV report
router.get('/report/csv', async (req, res) => {
  const volunteers = await Volunteer.find().populate('participations'); // Adjust the query based on your schema
  const data = [];

  volunteers.forEach(volunteer => {
    volunteer.participations.forEach(participation => {
      data.push({
        Volunteer: volunteer.name,
        Event: participation.event.name,
        Date: participation.date
      });
    });
  });

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
});

module.exports = router;
