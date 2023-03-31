import * as fs from 'fs'
import * as path from 'path'
import nodemailer from 'nodemailer'
import type { MailConfig } from '../storage/model'
import { getCacheConfig } from '../storage/config'

export async function sendVerifyMail(toMail: string, verifyUrl: string) {
  const config = (await getCacheConfig())

  const templatesPath = path.join(__dirname, 'templates')
  const mailTemplatePath = path.join(templatesPath, 'mail.template.html')
  let mailHtml = fs.readFileSync(mailTemplatePath, 'utf8')
  mailHtml = mailHtml.replace(/\${VERIFY_URL}/g, verifyUrl)
  sendMail(toMail, 'AiBuddy.ru: Подтверждение регистрации', mailHtml, config.mailConfig)
}

export async function sendTestMail(toMail: string, config: MailConfig) {
  return sendMail(toMail, '测试邮件|Test mail', '这是一封测试邮件|This is test mail', config)
}

async function sendMail(toMail: string, subject: string, html: string, config: MailConfig) {
  const mailOptions = {
    from: config.smtpUserName,
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
