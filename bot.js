/**
 * linkbot
 */

// Load environment variables
require('dotenv').config({ silent: true })

// Dependencies
const axios = require('axios')
const getUrls = require('get-urls')
const querystring = require('querystring')
const Botkit = require('botkit')
const controller = Botkit.slackbot()

// Axios instance for use with Firebase REST API
const db = axios.create({
  baseURL: process.env.FIREBASE_DB_URL,
  params: { auth: process.env.FIREBASE_SECRET }
})

// Bot
const bot = controller.spawn({
  token: process.env.SLACK_API_TOKEN
})

// Fire up the 🤖!
bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error('Could not connect to Slack')
  }
})

// Save link to DB
function saveLink(url, message) {
  const { channel, user } = message
  return db.post('links.json', {
    url,
    channel,
    user,
    created: Date.now()
  })
}

// Find link in the DB
function findLink(url, message) {
  const params = querystring.stringify({
    orderBy: '\"url\"',
    equalTo: `\"${url}\"`
  })
  return db.get(`links.json?${params}`).then((res) => {
    if (res.status === 200 && !isEmpty(res.data)) {
      const key = Object.keys(res.data)
      return res.data[key]
    }
    saveLink(url, message)
  })
}

// Helpers
function isEmpty(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object
}

function extractUrls(str) {
  const sanitized = str
    .replace(/\|[^>]*/g, '') // remove | in some URLs
    .replace(/[<>]/g, '') // remove all < > from str
  return  Array.from(getUrls(sanitized))
}

// Listen for 'ambient' aka any new message
controller.on('ambient', (bot, message) => {
  const { text, ts, user } = message
  const urls = extractUrls(text)
  for (url of urls) {
    findLink(url, message).then((link) => {
      if (link && !isEmpty(link)) {
        bot.reply(message, `The link [${link.url}] has already been posted!`)
      }
    }).catch(err => console.log(err))
  }
})
