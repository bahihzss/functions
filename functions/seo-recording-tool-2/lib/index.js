const { setGlobalOptions } = require('firebase-functions/v2')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onTaskDispatched } = require('firebase-functions/v2/tasks')
const { onRequest } = require('firebase-functions/v2/https')
const { trigger } = require('./trigger')
const { rakuten } = require('./rakuten')
const { amazon } = require('./amazon')

setGlobalOptions({
  region: 'asia-northeast2',
  memory: '1GiB',
  timeoutSeconds: 540,
})

const onEmulator = (handler) => onRequest(async (req, res) => {
  const { id, name } = req.query
  await handler({ id, name })
  res.send('DONE')
})

const onProduct = (handler) => onTaskDispatched({
  retryConfig: {
    maxAttempts: 5,
    maxBackoffSeconds: 300,
  },
  rateLimits: {
    maxConcurrentDispatches: 1,
  }
}, handler)

exports.seorecordingtool2rakuten = process.env.FUNCTIONS_EMULATOR === 'true' ? onEmulator(rakuten) : onProduct(rakuten)
exports.seorecordingtool2amazon = process.env.FUNCTIONS_EMULATOR === 'true' ? onEmulator(amazon) : onProduct(amazon)

exports.seorecordingtool2trigger = onSchedule({
  schedule: 'every day 0:00',
  timeZone: 'Asia/Tokyo',
}, trigger)