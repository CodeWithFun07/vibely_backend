import { createTransport } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailPort = Number(process.env.EMAIL_PORT) || 587;
const transporter = createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: emailPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  family: 4,
});

export default transporter;
