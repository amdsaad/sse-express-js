/********************************************************************
 * app.js
 * 1) Install dependencies:
 *    npm install express @supabase/supabase-js
 * 2) Set SUPABASE_URL & SUPABASE_SERVICE_KEY in your environment.
 * 3) Run with:
 *    node app.js
 ********************************************************************/

import express from 'express'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'


import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Configure Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 2. Define our backend logic
async function performBackendOperations() {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }

    // Example: fetching from 'orders' table
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('state', 'open')

    if (error) {
      console.error('Error fetching open orders:', error)
      return { healthCheck, orders: [], error: error.message }
    }

    return { healthCheck, orders }
  } catch (error) {
    console.error('Error performing backend operations:', error)
    return { error: 'An unexpected error occurred' }
  }
}

// 3. SSE endpoint
app.get('/sse', async (req, res) => {
  // Set SSE headers
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  // Flush headers so the client receives them immediately
  // (sometimes helpful with certain proxies)
  res.flushHeaders()

  // Function to send data to the client
  const sendData = async () => {
    try {
      const data = await performBackendOperations()
      // SSE requires the format: "data: ...\n\n"
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch (error) {
      console.error('Error in sendData:', error)
      res.write(`data: {"error": "Failed to perform operations"}\n\n`)
    }
  }

  // Send initial data immediately
  await sendData()

  // Send updates every 60 seconds
  const intervalId = setInterval(sendData, 60000)

  // If client closes connection, clean up
  req.on('close', () => {
    clearInterval(intervalId)
  })
})

// 4. Basic homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

// 5. Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
