import * as fs from 'fs'
import * as path from 'path'
import nodemailer from 'nodemailer'

export async function sendVerifyMail(toMail: string, verifyUrl: string) {
  const templatesPath = path.join(__dirname, 'templates')
  const mailTemplatePath = path.join(templatesPath, 'mail.template.html')
  let mailHtml = fs.readFileSync(mailTemplatePath, 'utf8')
  mailHtml = mailHtml.replace(/\${VERIFY_URL}/g, verifyUrl)
  sendMail(toMail, 'AiBuddy.ru: Подтверждение регистрации', mailHtml)
}

export async function sendTestMail(toMail: string) {
  return sendMail(toMail, '测试邮件|Test mail', '这是一封测试邮件|This is test mail')
}

async function sendMail(toMail: string, subject: string, html: string) {
  const mailOptions = {
    from: process.env.SMTP_SENDER,
    to: toMail,
    subject,
    html,
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_TSL,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  })
  const info = await transporter.sendMail(mailOptions)
  return info.messageId
}
