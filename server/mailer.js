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
  // Always log to console (dev) and to a file so OTP is never lost
  const line = `[mailer] OTP for ${email}: ${otp} (valid 15 min) — ${new Date().toISOString()}`;
  console.log(line);
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(path.join(__dirname, "otp.log"), line + "\n");
    fs.writeFileSync(path.join(__dirname, "last-otp.json"), JSON.stringify({ email, otp, created_at: new Date().toISOString() }, null, 2));
  } catch {}
  if (!tx) {
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
