const nodemailer = require('nodemailer');
const session = require('./session');


async function sendMail(subject, text) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: session.email.user,
            pass: session.email.pass
        }
    });

    let mailOptions = {
        from: session.email.user,
        to: session.email.user,
        subject: subject,
        text: text
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ' + error);
    }
}

module.exports = sendMail;