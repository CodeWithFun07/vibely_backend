import transporter from "../config/nodemailer.config.js";

const sendMail = async ({ to, subject, html }) => {
  try {
    const res = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    if (
      !res ||
      !Array.isArray(res.accepted) ||
      res.accepted.length === 0
    ) {
      const msg =
        res?.response ||
        "SMTP did not accept the message (no accepted recipients).";
      throw new Error(msg);
    }
    return res;
  } catch (error) {
    console.error("Error sending email:", error?.message || error);
    throw error;
  }
};

export default sendMail;
