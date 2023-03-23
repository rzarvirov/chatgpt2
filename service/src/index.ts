import express from 'express'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import type { ChatOptions, UserInfo } from './storage/model'
import { Status } from './storage/model'
import { clearChat, createChatRoom, createUser, deleteChat, deleteChatRoom, existsChatRoom, getChat, getChatRooms, getChats, getUser, getUserAccountType, getUserBalance, getUserById, getUserProBalance, insertChat, renameChatRoom, updateChat, updateUserBalance, updateUserInfo, updateUserProBalance, verifyUser } from './storage/mongo'
import { sendMail } from './utils/mail'
import { checkUserVerify, getUserVerifyUrl, md5 } from './utils/security'
import { isNotEmptyString } from './utils/is'

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
  const userId = req.headers.userId
  const accounttype = await getUserAccountType(userId)

  res.send({ status: 'Success', message: null, data: { accounttype } })
})
// got account type

// get balance
router.get('/balance', auth, async (req, res) => {
  const userId = req.headers.userId
  const balance = await getUserBalance(userId)

  res.send({ status: 'Success', message: null, data: { balance } })
})
// got balance

// update balance
router.post('/update-balance', auth, async (req, res) => {
  const userId = req.headers.userId
  const newBalance = req.body.newBalance
  await updateUserBalance(userId, newBalance)
  res.send({ status: 'Success', message: null, data: null })
})
// updated balance

// get probalance
router.get('/probalance', auth, async (req, res) => {
  const userId = req.headers.userId
  const probalance = await getUserProBalance(userId)

  res.send({ status: 'Success', message: null, data: { probalance } })
})
// got probalance

// update probalance
router.post('/update-probalance', auth, async (req, res) => {
  const userId = req.headers.userId
  const newProBalance = req.body.newProBalance
  await updateUserProBalance(userId, newProBalance)
  res.send({ status: 'Success', message: null, data: null })
})
// updated probalance

router.get('/chatrooms', auth, async (req, res) => {
  const userId = req.headers.userId
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
})

router.post('/room-create', auth, async (req, res) => {
  const userId = req.headers.userId
  const { title, roomId } = req.body as { title: string; roomId: number }
  const room = await createChatRoom(userId, title, roomId)
  res.send({ status: 'Success', message: null, data: room })
})

router.post('/room-rename', auth, async (req, res) => {
  const userId = req.headers.userId
  const { title, roomId } = req.body as { title: string; roomId: number }
  const room = await renameChatRoom(userId, title, roomId)
  res.send({ status: 'Success', message: null, data: room })
})

router.post('/room-delete', auth, async (req, res) => {
  const userId = req.headers.userId
  const { roomId } = req.body as { roomId: number }
  if (!roomId || !await existsChatRoom(userId, roomId)) {
    res.send({ status: 'Fail', message: 'Unknow room', data: null })
    return
  }
  await deleteChatRoom(userId, roomId)
  res.send({ status: 'Success', message: null })
})

router.get('/chat-hisroty', auth, async (req, res) => {
  const userId = req.headers.userId
  const roomId = +req.query.roomid
  const lastTime = req.query.lasttime
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
})

router.post('/chat-delete', auth, async (req, res) => {
  const userId = req.headers.userId
  const { roomId, uuid, inversion } = req.body as { roomId: number; uuid: number; inversion: boolean }
  if (!roomId || !await existsChatRoom(userId, roomId)) {
    res.send({ status: 'Fail', message: 'Unknow room', data: null })
    return
  }
  await deleteChat(roomId, uuid, inversion)
  res.send({ status: 'Success', message: null, data: null })
})

router.post('/chat-clear', auth, async (req, res) => {
  const userId = req.headers.userId
  const { roomId } = req.body as { roomId: number }
  if (!roomId || !await existsChatRoom(userId, roomId)) {
    res.send({ status: 'Fail', message: 'Unknow room', data: null })
    return
  }
  await clearChat(roomId)
  res.send({ status: 'Success', message: null, data: null })
})

router.post('/chat', auth, async (req, res) => {
  try {
    const { roomId, uuid, regenerate, prompt, options = {} } = req.body as
      { roomId: number; uuid: number; regenerate: boolean; prompt: string; options?: ChatContext }
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    const response = await chatReplyProcess(prompt, options)
    if (response.status === 'Success')
      await updateChat(message._id, response.data.text, response.data.id)
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/chat-process', auth, async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { roomId, uuid, regenerate, prompt, options = {}, model } = req.body as
      { roomId: number; uuid: number; regenerate: boolean; prompt: string; options?: ChatContext; model?: string }
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    let firstChunk = true
    const result = await chatReplyProcess(prompt, options, (chat: ChatMessage) => {
      res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
      firstChunk = false
    }, model)
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
  const { username, password } = req.body as { username: string; password: string }

  if (process.env.REGISTER_ENABLED !== 'true') {
    res.send({ status: 'Fail', message: 'Регистрация новых пользователь временно приостановлена', data: null })
    return
  }
  if (typeof process.env.REGISTER_MAILS === 'string' && process.env.REGISTER_MAILS.length > 0) {
    let allowSuffix = false
    const emailSuffixs = process.env.REGISTER_MAILS.split(',')
    for (let index = 0; index < emailSuffixs.length; index++) {
      const element = emailSuffixs[index]
      allowSuffix = username.toLowerCase().endsWith(element)
      if (allowSuffix)
        break
    }
    if (!allowSuffix) {
      res.send({ status: 'Fail', message: 'Такая почтовый сервис не поддерживается', data: null })
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
    sendMail(username, getUserVerifyUrl(username))
    res.send({ status: 'Success', message: 'Проверьте почту для подтверждения регистрации', data: null })
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    const allowRegister = process.env.REGISTER_ENABLED === 'true'
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, allowRegister, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-login', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    if (!username || !password)
      throw new Error('Имя или пароль не введены')

    const user = await getUser(username)
    if (user == null
      || user.status !== Status.Normal
      || user.password !== md5(password)) {
      if (user != null && user.status === Status.PreVerify)
        throw new Error('Проверьте почту для подтверждения регистрации')
      throw new Error('Имя не найдено или пароль введен не верно, попробуйте еще')
    }

    const token = jwt.sign({
      name: user.name ? user.name : user.email,
      avatar: user.avatar,
      description: user.description,
      userId: user._id,
      root: username.toLowerCase() === process.env.ROOT_USER,
    }, process.env.AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: 'Добро пожаловать!', data: { token } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-info', auth, async (req, res) => {
  try {
    const { name, avatar, description } = req.body as UserInfo
    const userId = new ObjectId(req.headers.userId.toString())

    const user = await getUserById(userId)
    if (user == null || user.status !== Status.Normal)
      throw new Error('用户不存在 | User does not exist.')
    await updateUserInfo(userId, { name, avatar, description } as UserInfo)
    res.send({ status: 'Success', message: '更新成功 | Update successfully' })
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

app.use('', router)
app.use('/api', router)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
