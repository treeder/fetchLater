/**
 * Requires: 
 * - env.API_KEY - used to authorize using this AND used to send back to the API scheduled endpoint
 * - env.SCHEDULED_URL - endpoint in an API to get scheduled stuff. 
 * 
 * You will need to setup a queue and CRON trigger in cloudflare. 
 */
export default {

  async fetch(req, env, ctx) {
    let apiKey = env.API_KEY
    let authHeader = req.headers.get("Authorization")
    if (!(authHeader?.split(' ')[1] == apiKey)) {
      return Response.json({ error: { message: "invalid key" } }, { status: 400 })
    }

    let input
    try {
      input = await req.json()
    } catch (e) {
      // Return a HTTP 400 (Bad Request) if the payload isn't JSON
      return Response.json({ error: { message: "payload not valid JSON" } }, { status: 400 })
    }

    console.log("input:", input)
    let messages = input.messages

    // Publish to the Queue
    for (let m of messages) {
      try {
        console.log("message:", m)
        await env.QUEUE.send(m, { delaySeconds: m.delaySeconds || 0 })
      } catch (e) {
        console.log(`failed to send to the queue: ${e}`)
        // Return a HTTP 500 (Internal Error) if our publish operation fails
        return Response.json({ error: { message: e.message } }, { status: 500 })
      }
    }

    // Return a HTTP 200 if the send succeeded!
    return Response.json({ success: true })
  },


  // consumer
  async queue(batch, env) {
    let messages = batch.messages
    console.log(`consuming from our queue: ${messages}`)
    for (let message of messages) {
      // Message: https://developers.cloudflare.com/queues/configuration/javascript-apis/#message
      console.log("message:", JSON.stringify(message))
      let m = message.body
      try {
        let options = m.options
        let b = options.body
        b.queued = true
        b.attempts = message.attempts
        options.body = JSON.stringify(b)
        let r = await fetch(m.url, m.options)
        console.log("r:", r.ok)
        if (!r.ok) {
          console.error("R NOT OK", r.status)
          let t = await r.text()
          console.log(t)
          throw new Error(t)
        }
        message.ack()
      } catch (e) {
        console.error("ERROR ON FETCH:", e)
        // throw e // retry delays don't seem to work
        message.retry({ delaySeconds: m.retrySeconds || 30 })
      }
    }
  },

  // https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
  async scheduled(event, env, ctx) {
    // let scheduledTime = new Date(event.scheduledTime)
    console.log(`Scheduled event fired. cron: ${event.cron}`)
    let r = await fetch(env.SCHEDULED_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apiKey ${env.API_KEY}`,
        },
        body: JSON.stringify(event),
      })
    console.log("R.ok:", r.ok)
    console.log(await r.text())
  },
}
