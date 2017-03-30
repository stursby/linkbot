/**
 * linkbot
 */

// Load environment variables
require('dotenv').config({ silent: true })

// Dependencies
const axios = require('axios')
const getUrls = require('get-urls')
const timeago = require('timeago.js')
const querystring = require('querystring')
const normalizeUrl = require('normalize-url')
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
    url: normalizeUrl(url, { normalizeHttps: true }),
    channel,
    user,
    created: Date.now()
  })
}

// Find link in the DB
function findLink(url, message) {
  const urlQuery = encodeURIComponent(normalizeUrl(url, { normalizeHttps: true }))
  const params = querystring.stringify({
    orderBy: '\"url\"',
    equalTo: `\"${urlQuery}\"`
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
  return Array.from(getUrls(sanitized))
}

function fetchUserInfo(userID) {
  return axios.get('https://slack.com/api/users.info', {
    params: {
      token: process.env.SLACK_API_TOKEN,
      user: userID
    }
  })
}

// Listen for 'ambient' aka any new message
controller.on('ambient', (bot, message) => {
  const { text, ts, user } = message
  const urls = extractUrls(text)
  for (url of urls) {
    findLink(url, message).then((link) => {
      if (link && !isEmpty(link)) {
        fetchUserInfo(link.user).then((res) => {
          const msg = (res.data.ok)
            ? `@${res.data.user.name} posted this`
            : 'This link was posted'
          const prettyTime = new timeago().format(link.created)
          const body = `Pssst. ${msg} ${prettyTime}. [${link.url}]`
          bot.startPrivateConversation(message, (err, dm) => {
            dm.say(body)
          })
        })
      }
    }).catch(err => console.log(err))
  }
})
