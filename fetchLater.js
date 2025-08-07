import api from "api"

/**
 * Requires c.env.FETCHLATER_URL to be set to the URL of the fetcher worker
 * and c.env.FETCHLATER_KEY to be set to the API key for the fetcher worker.
 * 
 * @param {*} c 
 * @param {*} messages 
 * @returns 
 */
export async function queue(c, messages) {
  if (c) c.data.logger.log("queuing up messages", messages)
  let queued = await api(c.env.FETCHLATER_URL, // URL to the fetcher worker
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "apiKey " + c.env.FETCHLATER_KEY,
      },
      body: {
        messages: messages,
      }
    })
  console.log("QUEUED!")
  return queued
}

export async function fetchLater(c, url, options = {}) {
  c.data.logger.log("fetchLater", url)
  let m = {}
  if (options.delaySeconds) {
    m.delaySeconds = options.delaySeconds
    delete options.delaySeconds
  }
  if (options.retrySeconds) {
    m.retrySeconds = options.retrySeconds
    delete options.retrySeconds
  }
  m.url = url
  m.options = options
  return await queue(c, [m])
}