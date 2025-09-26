// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

app.post('/send-otp', async (req, res) => {
    const { phoneNumber, otp } = req.body;

    try {
        const response = await axios.post('https://textbelt.com/text', {
            phone: phoneNumber,
            message: `Your OTP code is: ${otp}`,
            key: 'textbelt', // Use the free key for testing
        });

        if (response.data.success) {
            return res.status(200).send('OTP sent successfully');
        } else {
            return res.status(500).send('Failed to send OTP');
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
