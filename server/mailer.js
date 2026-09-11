// Outgoing email (password-reset OTPs). Nodemailer + any SMTP inbox.
// Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
//      SMTP_FROM (default "myNest <no-reply@mynest.in>").
// If SMTP is not configured (local dev), the OTP is logged to the console
// instead so flows remain testable — sendOtp returns false in that case.
const nodemailer = require("nodemailer");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendOtp(email, otp) {
  const tx = getTransporter();
  if (!tx) {
    console.log(`[mailer] SMTP not configured — OTP for ${email}: ${otp}`);
    return false;
  }
  await tx.sendMail({
    from: process.env.SMTP_FROM || "myNest <no-reply@mynest.in>",
    to: email,
    subject: "myNest password reset code",
    text:
      `Your myNest password reset code is: ${otp}\n\n` +
      `It expires in 15 minutes. If you didn't ask for this, ignore this email.`,
  });
  return true;
}

module.exports = { sendOtp };
