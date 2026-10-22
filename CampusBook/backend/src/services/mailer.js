
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST?.trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);

const mailFrom =
  process.env.MAIL_FROM || 'CampusBook <no-reply@campusbook.test>';

let transporter = null;

// Configure email delivery only when an SMTP server is provided.
if (smtpHost) {
  const options = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    options.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  transporter = nodemailer.createTransport(options);
}

async function sendMail(to, subject, text) {
  if (!to || typeof to !== 'string') {
    throw new Error('A valid recipient email address is required');
  }

  if (!subject || typeof subject !== 'string') {
    throw new Error('An email subject is required');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Email message content is required');
  }

  // Development mode: preview emails without sending them.
  if (!transporter) {
    console.log('\n--- CampusBook Email Preview ---');
    console.log('From:', mailFrom);
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Message:', text);
    console.log('--- End Email Preview ---\n');

    return { preview: true };
  }

  // Send the email using the configured SMTP server.
  return transporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
  });
}

module.exports = { sendMail };
