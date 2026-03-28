require('dotenv').config();
const sgMail = require('@sendgrid/mail');

const REF = 'JRMMLMPJFH';
const TO = 'luther2leo@gmail.com';

if (!process.env.SENDGRID_API_KEY) {
  console.error('SendGrid API key not found in environment variables');
  process.exit(1);
}
if (!process.env.FROM_EMAIL) {
  console.error('FROM_EMAIL not set in .env');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function send() {
  const msg = {
    to: TO,
    from: process.env.FROM_EMAIL,
    subject: `JRMSU Guidance Office - Delivery Test (Ref: ${REF})`,
    text: `This is a delivery test for appointment ref ${REF}. If you receive this email, delivery is working.`,
    html: `<p>This is a delivery test for appointment ref <strong>${REF}</strong>. If you receive this email, delivery is working.</p>`
  };

  try {
    const res = await sgMail.send(msg);
    if (Array.isArray(res) && res[0]) {
      console.log('Email send attempt result:', res[0].statusCode);
      console.log('SendGrid headers:', res[0].headers);
    } else {
      console.log('Email send attempt result:', res && res.statusCode);
      console.log('SendGrid response headers:', res && res.headers);
    }
    console.log('Test email script completed successfully.');
  } catch (err) {
    console.error('Failed to send test email:');
    console.error(err.response ? err.response.body : err);
    process.exit(2);
  }
}

send();
