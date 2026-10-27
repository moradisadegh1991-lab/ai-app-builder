import nodemailer from "nodemailer";
import { env } from "./env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends through Resend when RESEND_API_KEY is set, otherwise through SMTP. */
export async function sendMail(message: MailMessage) {
  const resendKey = env.resendApiKey();
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.mailFrom(), to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!response.ok) throw new Error(`Resend error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return;
  }

  const host = env.smtpHost();
  if (host) {
    const port = env.smtpPort();
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: env.smtpUser() ? { user: env.smtpUser(), pass: env.smtpPass() } : undefined,
    });
    await transport.sendMail({ from: env.mailFrom(), ...message });
    return;
  }

  if (!env.isProduction()) {
    // Local development without a mail service: print instead of sending.
    console.info(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }
  throw new Error("هیچ سرویس ایمیلی تنظیم نشده است (RESEND_API_KEY یا SMTP_HOST).");
}
