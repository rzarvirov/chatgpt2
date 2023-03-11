import nodemailer from 'nodemailer'

// create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_TSL,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
})

export function sendMail(toMail: string, verifyUrl: string) {
  const mailOptions = {
    from: process.env.SMTP_USERNAME, // sender address
    to: toMail, // list of receivers
    subject: 'aibuddy.ru: Подтверждение регистрации', // Subject line
    // text: 'Hello world?', // plain text body
    html: `<h1>Вы регистрируетесь на сайте aibuddy.ru, ссылка для подтверждения вашего электронного адреса: (действительна в течение 12 часов)</h1><br/><br/><a target="_blank" href="${verifyUrl}">Подтвердить регистрацию</a>`, // html body
  }

  // send mail with defined transport object
  transporter.sendMail(mailOptions, (error, info) => {
    if (error)
      throw error
    else
      return info.messageId
  })
}
