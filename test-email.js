require('dotenv').config();
const sgMail = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
  console.error('SendGrid API key not found in environment variables');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendTestEmail() {
  const msg = {
    to: 'shutijv@gmail.com',
    from: process.env.FROM_EMAIL,
    subject: 'JRMSU Guidance Office - Email Test',
    text: 'This is a test email to verify SendGrid configuration.',
    html: '<p>This is a test email to verify SendGrid configuration.</p>',
  };

  try {
    await sgMail.send(msg);
    console.log('Test email sent successfully!');
  } catch (error) {
    console.error('Error sending test email:');
    console.error(error.response ? error.response.body : error);
  }
}

sendTestEmail();