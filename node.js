// server.js (Backend)
const express = require('express');
const twilio = require('twilio');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const accountSid = 'your_twilio_account_sid';
const authToken = 'your_twilio_auth_token';
const client = new twilio(accountSid, authToken);

// Route to handle sending OTP
app.post('/send-otp', (req, res) => {
  const { phoneNumber } = req.body;

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // Send OTP via Twilio
  client.messages
    .create({
      body: `Your OTP is: ${otp}`,
      to: phoneNumber,
      from: 'your_twilio_phone_number', // Twilio number
    })
    .then((message) => {
      console.log(`OTP sent: ${message.sid}`);
      // You can save the OTP in your database for later verification
      res.json({ success: true, otp });  // You might want to store OTP on the server side
    })
    .catch((error) => {
      console.error('Error sending OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
