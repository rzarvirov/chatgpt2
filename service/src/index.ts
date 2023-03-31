import express from 'express'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import type { RequestProps } from './types'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel, initApi } from './chatgpt'
import { auth } from './middleware/auth'
import { clearConfigCache, getCacheConfig, getOriginConfig } from './storage/config'
import type { ChatOptions, Config, MailConfig, SiteConfig, UserInfo } from './storage/model'
import { Status } from './storage/model'
import { clearChat, createChatRoom, createUser, deleteAllChatRooms, deleteChat, deleteChatRoom, existsChatRoom, getChat, getChatRooms, getChats, getUser, getUserAccountType, getUserBalance, getUserById, getUserProBalance, insertChat, renameChatRoom, updateChat, updateConfig, updateUserBalance, updateUserInfo, updateUserProBalance, verifyUser } from './storage/mongo'
import { limiter } from './middleware/limiter'
import { sendTestMail, sendVerifyMail } from './utils/mail'
import { checkUserVerify, getUserVerifyUrl, md5 } from './utils/security'
import { isEmail, isNotEmptyString } from './utils/is'
import { rootAuth } from './middleware/rootAuth'

const googleClientId = '474493346119-5o0f10gmqbr1ecdj8is1igk74jp65422.apps.googleusercontent.com'
const googleClient = new OAuth2Client(googleClientId)

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

// get account type
router.get('/accounttype', auth, async (req, res) => {
  const userId = req.headers.userId.toString()
  const accounttype = await getUserAccountType(userId)

  res.send({ status: 'Success', message: null, data: { accounttype } })
})
// got account type

// get balance
router.get('/balance', auth, async (req, res) => {
  const userId = req.headers.userId.toString()
  const balance = await getUserBalance(userId)

  res.send({ status: 'Success', message: null, data: { balance } })
})
// got balance

// update balance
router.post('/update-balance', auth, async (req, res) => {
  const userId = req.headers.userId.toString()
  const newBalance = req.body.newBalance
  await updateUserBalance(userId, newBalance)
  res.send({ status: 'Success', message: null, data: null })
})
// updated balance

// get probalance
router.get('/probalance', auth, async (req, res) => {
  const userId = req.headers.userId.toString()
  const probalance = await getUserProBalance(userId)

  res.send({ status: 'Success', message: null, data: { probalance } })
})
// got probalance

// update probalance
router.post('/update-probalance', auth, async (req, res) => {
  const userId = req.headers.userId.toString()
  const newProBalance = req.body.newProBalance
  await updateUserProBalance(userId, newProBalance)
  res.send({ status: 'Success', message: null, data: null })
})
// updated probalance

router.get('/chatrooms', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const rooms = await getChatRooms(userId)
    const result = []
    rooms.forEach((r) => {
      result.push({
        uuid: r.roomId,
        title: r.title,
        isEdit: false,
      })
    })
    res.send({ status: 'Success', message: null, data: result })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Load error', data: [] })
  }
})

router.post('/room-create', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { title, roomId } = req.body as { title: string; roomId: number }
    const room = await createChatRoom(userId, title, roomId)
    res.send({ status: 'Success', message: null, data: room })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Create error', data: null })
  }
})

router.post('/room-rename', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { title, roomId } = req.body as { title: string; roomId: number }
    const room = await renameChatRoom(userId, title, roomId)
    res.send({ status: 'Success', message: null, data: room })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Rename error', data: null })
  }
})

router.post('/room-delete', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId } = req.body as { roomId: number }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await deleteChatRoom(userId, roomId)
    res.send({ status: 'Success', message: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.get('/chat-hisroty', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const roomId = +req.query.roomid
    const lastTime = req.query.lasttime as string
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Success', message: null, data: [] })
      // res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    const chats = await getChats(roomId, !lastTime ? null : parseInt(lastTime))

    const result = []
    chats.forEach((c) => {
      if (c.status !== Status.InversionDeleted) {
        result.push({
          uuid: c.uuid,
          dateTime: new Date(c.dateTime).toLocaleString(),
          text: c.prompt,
          inversion: true,
          error: false,
          conversationOptions: null,
          requestOptions: {
            prompt: c.prompt,
            options: null,
          },
        })
      }
      if (c.status !== Status.ResponseDeleted) {
        result.push({
          uuid: c.uuid,
          dateTime: new Date(c.dateTime).toLocaleString(),
          text: c.response,
          inversion: false,
          error: false,
          loading: false,
          conversationOptions: {
            parentMessageId: c.options.messageId,
          },
          requestOptions: {
            prompt: c.prompt,
            parentMessageId: c.options.parentMessageId,
          },
        })
      }
    })

    res.send({ status: 'Success', message: null, data: result })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Load error', data: null })
  }
})

router.post('/chat-delete', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId, uuid, inversion } = req.body as { roomId: number; uuid: number; inversion: boolean }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await deleteChat(roomId, uuid, inversion)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat-clear-all', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    await deleteAllChatRooms(userId)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat-clear', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId } = req.body as { roomId: number }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await clearChat(roomId)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat', auth, async (req, res) => {
  try {
    const { roomId, uuid, regenerate, prompt, options = {} } = req.body as
      { roomId: number; uuid: number; regenerate: boolean; prompt: string; options?: ChatContext }
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    const response = await chatReply(prompt, options)
    if (response.status === 'Success')
      await updateChat(message._id, response.data.text, response.data.id)
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { roomId, uuid, regenerate, prompt, options = {}, systemMessage, model } = req.body as RequestProps
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    let firstChunk = true
    const result = await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      model,
    })
    if (result.status === 'Success')
      await updateChat(message._id, result.data.text, result.data.id)
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/user-register', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    const config = await getCacheConfig()
    if (!config.siteConfig.registerEnabled) {
      res.send({ status: 'Fail', message: 'Регистрация новых пользователь временно приостановлена', data: null })
      return
    }
    if (!isEmail(username)) {
      res.send({ status: 'Fail', message: 'Введите правильны email', data: null })
      return
    }
    if (isNotEmptyString(config.siteConfig.registerMails)) {
      let allowSuffix = false
      const emailSuffixs = config.siteConfig.registerMails.split(',')
      for (let index = 0; index < emailSuffixs.length; index++) {
        const element = emailSuffixs[index]
        allowSuffix = username.toLowerCase().endsWith(element)
        if (allowSuffix)
          break
      }
      if (!allowSuffix) {
        res.send({ status: 'Fail', message: 'Такой почтовый сервис не поддерживается', data: null })
        return
      }
    }

    const user = await getUser(username)
    if (user != null) {
      res.send({ status: 'Fail', message: 'Имя уже используется', data: null })
      return
    }
    const newPassword = md5(password)
    await createUser(username, newPassword)

    if (username.toLowerCase() === process.env.ROOT_USER) {
      res.send({ status: 'Success', message: 'Ура!', data: null })
    }
    else {
      await sendVerifyMail(username, await getUserVerifyUrl(username))
      res.send({ status: 'Success', message: 'Проверьте почту для подтверждения регистрации', data: null })
    }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const userId = req.headers.userId.toString()

    const user = await getUserById(userId)
    if (user == null || user.status !== Status.Normal || user.email.toLowerCase() !== process.env.ROOT_USER)
      throw new Error('Нет доступа')

    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const config = await getCacheConfig()
    const hasAuth = config.siteConfig.loginEnabled
    const allowRegister = (await getCacheConfig()).siteConfig.registerEnabled
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, allowRegister, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-login', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    if (!username || !password || !isEmail(username))
      throw new Error('Имя или пароль не введены')

    const user = await getUser(username)
    if (user == null
      || user.status !== Status.Normal
      || user.password !== md5(password)) {
      if (user != null && user.status === Status.PreVerify)
        throw new Error('Проверьте почту для подтверждения регистрации')
      throw new Error('Имя не найдено или пароль введен не верно, попробуйте еще')
    }
    const config = await getCacheConfig()
    const token = jwt.sign({
      name: user.name ? user.name : user.email,
      avatar: user.avatar,
      description: user.description,
      userId: user._id,
      root: username.toLowerCase() === process.env.ROOT_USER,
    }, config.siteConfig.loginSalt.trim())
    res.send({ status: 'Success', message: 'Добро пожаловать!', data: { token } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-info', auth, async (req, res) => {
  try {
    const { name, avatar, description } = req.body as UserInfo
    const userId = req.headers.userId.toString()

    const user = await getUserById(userId)
    if (user == null || user.status !== Status.Normal)
      throw new Error('Пользователя не существует')
    await updateUserInfo(userId, { name, avatar, description } as UserInfo)
    res.send({ status: 'Success', message: 'Обновлено' })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')
    const username = await checkUserVerify(token)
    await verifyUser(username)
    res.send({ status: 'Success', message: 'Добро пожаловать!', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-base', rootAuth, async (req, res) => {
  try {
    const { apiKey, apiModel, apiBaseUrl, accessToken, timeoutMs, socksProxy, httpsProxy } = req.body as Config

    if (apiKey == null && accessToken == null)
      throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable.')

    const thisConfig = await getOriginConfig()
    thisConfig.apiKey = apiKey
    thisConfig.apiModel = apiModel
    thisConfig.apiBaseUrl = apiBaseUrl
    thisConfig.accessToken = accessToken
    thisConfig.timeoutMs = timeoutMs
    thisConfig.socksProxy = socksProxy
    thisConfig.httpsProxy = httpsProxy
    await updateConfig(thisConfig)
    clearConfigCache()
    initApi()
    const response = await chatConfig()
    res.send({ status: 'Success', message: 'Успешно', data: response.data })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-site', rootAuth, async (req, res) => {
  try {
    const config = req.body as SiteConfig

    const thisConfig = await getOriginConfig()
    thisConfig.siteConfig = config
    const result = await updateConfig(thisConfig)
    clearConfigCache()
    res.send({ status: 'Success', message: 'Успешно', data: result.siteConfig })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-mail', rootAuth, async (req, res) => {
  try {
    const config = req.body as MailConfig

    const thisConfig = await getOriginConfig()
    thisConfig.mailConfig = config
    const result = await updateConfig(thisConfig)
    clearConfigCache()
    res.send({ status: 'Success', message: 'Успешно', data: result.mailConfig })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/mail-test', rootAuth, async (req, res) => {
  try {
    const config = req.body as MailConfig
    const userId = req.headers.userId as string
    const user = await getUserById(userId)
    await sendTestMail(user.email, config)
    res.send({ status: 'Success', message: 'Успешно', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

// Google Auth

router.post('/google-login', async (req, res) => {
  try {
    const { idToken } = req.body as { idToken: string }

    if (!idToken)
      throw new Error('ID token is empty')

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    })
    const payload = ticket.getPayload()
    const googleEmail = payload.email

    let user = await getUser(googleEmail)

    if (user === null) {
      // Register & verify new user
      await createUser(googleEmail, '') // Empty password for Google users
      await verifyUser(googleEmail)
      user = await getUser(googleEmail)
    }

    const token = jwt.sign({
      name: user.name ? user.name : user.email,
      avatar: user.avatar,
      description: user.description,
      userId: user._id,
      root: googleEmail.toLowerCase() === process.env.ROOT_USER,
    }, process.env.AUTH_SECRET_KEY)

    res.send({ status: 'Success', message: 'Welcome!', data: { token } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

// End of Google Auth

app.use('', router)
app.use('/api', router)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
