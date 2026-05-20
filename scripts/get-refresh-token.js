#!/usr/bin/env node
/**
 * One-time script to obtain a Gmail OAuth2 refresh token.
 * Run: node scripts/get-refresh-token.js
 * Then add GMAIL_REFRESH_TOKEN to your Vercel env vars.
 */

import { google } from 'googleapis'
import http from 'http'
import { URL } from 'url'

const CLIENT_ID = process.env.GMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3001/oauth2callback'
const SCOPES = ['https://www.googleapis.com/auth/gmail.send']

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nError: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set as env vars.\n')
  console.error('Example:\n  GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/get-refresh-token.js\n')
  process.exit(1)
}

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES
})

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  iCANS Timesheet — Gmail OAuth2 Setup')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n1. Open this URL in your browser and log in as dani@icans.ai:\n')
console.log('  ' + authUrl)
console.log('\n2. After authorizing, you will be redirected and the refresh token')
console.log('   will be printed below.\n')
console.log('Waiting for OAuth callback on http://localhost:3001 ...\n')

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3001')
    if (url.pathname !== '/oauth2callback') {
      res.end('Not found')
      return
    }
    const code = url.searchParams.get('code')
    if (!code) {
      res.end('No code received.')
      return
    }
    const { tokens } = await auth.getToken(code)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h2 style="font-family:sans-serif;color:green">✓ Token received! Check your terminal.</h2>')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('SUCCESS! Add this to your Vercel environment variables:\n')
    console.log('  GMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    server.close()
    process.exit(0)
  } catch (err) {
    res.end('Error: ' + err.message)
    console.error('Error getting token:', err)
    server.close()
    process.exit(1)
  }
})

server.listen(3001)
