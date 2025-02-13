import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { ChatInfo, ChatRoom, Status, UserInfo } from './model'
import type { ChatOptions, Config } from './model'

dotenv.config()

const url = process.env.MONGODB_URL
const client = new MongoClient(url)
const chatCol = client.db('chatgpt').collection('chat')
const roomCol = client.db('chatgpt').collection('chat_room')
const userCol = client.db('chatgpt').collection('user')
const configCol = client.db('chatgpt').collection('config')

/**
 * 插入聊天信息
 * @param uuid
 * @param text 内容 prompt or response
 * @param roomId
 * @param options
 * @returns model
 */
export async function insertChat(uuid: number, text: string, roomId: number, options?: ChatOptions) {
  const chatInfo = new ChatInfo(roomId, uuid, text, options)
  await chatCol.insertOne(chatInfo)
  return chatInfo
}

export async function getChat(roomId: number, uuid: number) {
  return await chatCol.findOne({ roomId, uuid })
}

export async function getChatByMessageId(messageId: string) {
  return await chatCol.findOne({ 'options.messageId': messageId }) as ChatInfo
}

export async function updateChat(chatId: string, response: string, messageId: string) {
  const query = { _id: new ObjectId(chatId) }
  const update = {
    $set: { 'response': response, 'options.messageId': messageId },
  }
  await chatCol.updateOne(query, update)
}

export async function createChatRoom(userId: string, title: string, roomId: number) {
  const room = new ChatRoom(userId, title, roomId)
  await roomCol.insertOne(room)
  return room
}

export async function renameChatRoom(userId: string, title: string, roomId: number) {
  const query = { userId, roomId }
  const update = {
    $set: {
      title,
    },
  }
  const result = await roomCol.updateOne(query, update)
  return result
}

export async function deleteChatRoom(userId: string, roomId: number) {
  const result = await roomCol.updateOne({ roomId, userId }, { $set: { status: Status.Deleted } })
  await clearChat(roomId)
  return result
}

export async function updateRoomPrompt(userId: string, roomId: number, prompt: string) {
  const query = { userId, roomId }
  const update = {
    $set: {
      prompt,
    },
  }
  const result = await roomCol.updateOne(query, update)
  return result.modifiedCount > 0
}

export async function getChatRooms(userId: string) {
  const cursor = await roomCol.find({ userId, status: { $ne: Status.Deleted } })
  const rooms = []
  await cursor.forEach(doc => rooms.push(doc))
  return rooms
}

export async function getChatRoom(userId: string, roomId: number) {
  return await roomCol.findOne({ userId, roomId, status: { $ne: Status.Deleted } }) as ChatRoom
}

export async function deleteAllChatRooms(userId: string) {
  await roomCol.updateMany({ userId, status: Status.Normal }, { $set: { status: Status.Deleted } })
  await chatCol.updateMany({ userId, status: Status.Normal }, { $set: { status: Status.Deleted } })
}

export async function existsChatRoom(userId: string, roomId: number) {
  const room = await roomCol.findOne({ roomId, userId })
  return !!room
}

export async function getChats(roomId: number, lastTime?: number) {
  if (!lastTime)
    lastTime = new Date().getTime()
  const query = { roomId, dateTime: { $lt: lastTime }, status: { $ne: Status.Deleted } }
  const sort = { dateTime: -1 }
  const limit = 200
  const cursor = await chatCol.find(query).sort(sort).limit(limit)
  const chats = []
  await cursor.forEach(doc => chats.push(doc))
  chats.reverse()
  return chats
}

export async function clearChat(roomId: number) {
  const query = { roomId }
  const update = {
    $set: {
      status: Status.Deleted,
    },
  }
  await chatCol.updateMany(query, update)
}

export async function deleteChat(roomId: number, uuid: number, inversion: boolean) {
  const query = { roomId, uuid }
  let update = {
    $set: {
      status: Status.Deleted,
    },
  }
  const chat = await chatCol.findOne(query)
  if (chat.status === Status.InversionDeleted && !inversion) { /* empty */ }
  else if (chat.status === Status.ResponseDeleted && inversion) { /* empty */ }
  else if (inversion) {
    update = {
      $set: {
        status: Status.InversionDeleted,
      },
    }
  }
  else {
    update = {
      $set: {
        status: Status.ResponseDeleted,
      },
    }
  }
  chatCol.updateOne(query, update)
}

export async function createUser(email: string, password: string, name?: string): Promise<UserInfo> {
  email = email.toLowerCase()
  const userInfo = new UserInfo(email, password)
  if (email === process.env.ROOT_USER)
    userInfo.status = Status.Normal

  // Set the name if provided
  if (name)
    userInfo.name = name

  await userCol.insertOne(userInfo)
  return userInfo
}

export async function updateUserInfo(userId: string, user: UserInfo) {
  const result = userCol.updateOne({ _id: new ObjectId(userId) }
    , { $set: { name: user.name, description: user.description, avatar: user.avatar } })
  return result
}

export async function getUser(email: string): Promise<UserInfo> {
  email = email.toLowerCase()
  return await userCol.findOne({ email }) as UserInfo
}

export async function getUserById(userId: string): Promise<UserInfo> {
  return await userCol.findOne({ _id: new ObjectId(userId) }) as UserInfo
}

export async function verifyUser(email: string) {
  email = email.toLowerCase()
  return await userCol.updateOne({ email }, { $set: { status: Status.Normal, verifyTime: new Date().toLocaleString() } })
}

export async function getConfig(): Promise<Config> {
  return await configCol.findOne() as Config
}

export async function updateConfig(config: Config): Promise<Config> {
  const result = await configCol.replaceOne({ _id: config._id }, config, { upsert: true })
  if (result.modifiedCount > 0 || result.upsertedCount > 0)
    return config
  return null
}

export async function getUserBalance(userId: string) {
  const user = await userCol.findOne({ _id: new ObjectId(userId) }, { projection: { balance: 1 } })
  return user ? user.balance : null
}

export async function getUserProBalance(userId: string) {
  const user = await userCol.findOne({ _id: new ObjectId(userId) }, { projection: { probalance: 1 } })
  return user ? user.probalance : null
}

export async function updateUserBalance(userId: string, newBalance: number) {
  await userCol.updateOne({ _id: new ObjectId(userId) }, { $set: { balance: newBalance } })
}

export async function updateUserProBalance(userId: string, newProBalance: number) {
  await userCol.updateOne({ _id: new ObjectId(userId) }, { $set: { probalance: newProBalance } })
}

export async function getUserAccountType(userId: string) {
  const user = await userCol.findOne({ _id: new ObjectId(userId) }, { projection: { accounttype: 1 } })
  return user ? user.accounttype : null
}

export async function getUserEmail(userId: string) {
  const user = await userCol.findOne({ _id: new ObjectId(userId) }, { projection: { email: 1 } })
  return user ? user.email : null
}
