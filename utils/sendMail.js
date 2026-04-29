import transporter from "../config/nodemailer.config.js";

const sendMail = async ({ to, subject, html }) => {
  try {
    const res = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return res;
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export default sendMail;
