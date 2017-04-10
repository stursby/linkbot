/**
 * linkbot Twitter
 */

// Load environment variables
require('dotenv').config({ silent: true })

// Dependencies
const admin = require('firebase-admin')
const Twit = require('twit')

// Firebase Admin setup
const serviceAccount = require('./linkbot-firebase-admin.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
})

const database = admin.database()
const linksRef = database.ref('links')

// Twitter client
const T = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

// Listen for new Links and Tweet
let first = true

linksRef.limitToLast(1).on('child_added', (snapshot) => {

  // Ignore first snapshot (as Firebase will always send 1 to begin, and this won't be the newest)
  if (first) {
    first = false
    return
  }

  // Tweet! 🐦
  const { url } = snapshot.val()
  T.post('statuses/update', { status: url }, (err, data, response) => {
    if (err) {
      console.log(err)
    }
    console.log(data)
  })

})
