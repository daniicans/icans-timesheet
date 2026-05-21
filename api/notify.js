import webpush from 'web-push'
import { kv } from '@vercel/kv'
import { google } from 'googleapis'
import PDFDocument from 'pdfkit'

webpush.setVapidDetails(
  'mailto:dani@icans.ai',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcHours(entry) {
  if (!entry) return 0
  if (entry.hours != null) return Number(entry.hours)
  if (!entry.start || !entry.end) return 0
  const [sh, sm] = entry.start.split(':').map(Number)
  const [eh, em] = entry.end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

function fmt12(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtRange(dates) {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const s = new Date(dates[0] + 'T00:00:00Z'), e = new Date(dates[6] + 'T00:00:00Z')
  return s.getUTCMonth() === e.getUTCMonth()
    ? `${mo[s.getUTCMonth()]} ${s.getUTCDate()} - ${e.getUTCDate()}`
    : `${mo[s.getUTCMonth()]} ${s.getUTCDate()} - ${mo[e.getUTCMonth()]} ${e.getUTCDate()}`
}

function getThursdayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const diff = (d.getUTCDay() + 3) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function getPayPeriod(thursdayStr) {
  const start = new Date(thursdayStr + 'T00:00:00Z')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function todayCST() {
  const d = new Date(new Date().getTime() + (-6 * 60 * 60000))
  return d.toISOString().slice(0, 10)
}

// ── PDF generation ───────────────────────────────────────────────────────────

async function generatePDF(periodDates, entries, settings) {
  const { name, rate } = settings
  const range = fmtRange(periodDates)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const NAVY = '#1e2a4a', GREEN = '#22c55e', GRAY = '#64748b', LIGHT = '#f8fafc'
    const W = doc.page.width - 100

    doc.rect(50, 30, W, 5).fill(GREEN)
    doc.roundedRect(50, 50, 36, 36, 6).fill(NAVY)
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(22).text('i', 50, 57, { width: 36, align: 'center' })
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text('iCANS', 96, 52)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text('Timesheet', 96, 70)
    doc.fillColor(GRAY).fontSize(9).text('PAY PERIOD', 370, 52)
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(range, 370, 64)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text(name, 370, 84)
    doc.roundedRect(370, 97, 70, 16, 4).fill('#dcfce7')
    doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9).text(`$${Number(rate).toFixed(2)}/hr`, 374, 101)

    let y = 130
    const cols = { date: 50, in: 240, out: 320, hrs: 400, amt: 460 }
    doc.rect(50, y, W, 22).fill(NAVY)
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9)
    doc.text('DATE', cols.date+4, y+7).text('TIME IN', cols.in, y+7).text('TIME OUT', cols.out, y+7)
    doc.text('HOURS', cols.hrs, y+7).text('AMOUNT', cols.amt, y+7)
    y += 22

    let totalHrs = 0
    periodDates.forEach((date, i) => {
      const e = entries[date]
      if (i % 2 === 1) doc.rect(50, y, W, 22).fill(LIGHT)
      const d = new Date(date + 'T00:00:00Z')
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
      doc.fillColor(NAVY).font('Helvetica').fontSize(10).text(label, cols.date+4, y+6)
      if (e && calcHours(e) > 0) {
        const hrs = calcHours(e), amt = hrs * rate
        totalHrs += hrs
        if (e.hours != null) {
          doc.text('—', cols.in, y+6).text('—', cols.out, y+6)
        } else {
          doc.text(fmt12(e.start), cols.in, y+6).text(fmt12(e.end), cols.out, y+6)
        }
        doc.font('Helvetica-Bold').text(`${hrs.toFixed(2)} hrs`, cols.hrs, y+6)
        doc.fillColor(GREEN).text(`$${amt.toFixed(2)}`, cols.amt, y+6)
      } else {
        doc.fillColor(GRAY).text('—', cols.in, y+6).text('—', cols.out, y+6).text('—', cols.hrs, y+6).text('—', cols.amt, y+6)
      }
      y += 22
    })

    doc.rect(50, y, W, 26).fill(NAVY)
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11).text('TOTAL', cols.date+4, y+7)
    doc.text(`${totalHrs.toFixed(2)} hrs`, cols.hrs, y+7)
    doc.fillColor(GREEN).fontSize(13).text(`$${(totalHrs*rate).toFixed(2)}`, cols.amt, y+5)
    y += 40

    doc.moveTo(50, y+30).lineTo(260, y+30).strokeColor('#cbd5e1').lineWidth(1).stroke()
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Employee Signature', 50, y+35)
    doc.text(`${name} · Date: ___________`, 50, y+47)
    const gen = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    doc.fillColor(GRAY).fontSize(8).text(`Generated ${gen}`, 380, y+35, { align: 'right', width: W-330 })
    doc.text('iCANS · icans.ai', 380, y+46, { align: 'right', width: W-330 })
    doc.end()
  })
}

// ── Email HTML ───────────────────────────────────────────────────────────────

function buildEmailHTML(periodDates, entries, settings, range) {
  const { name, rate } = settings
  let totalHrs = 0
  const rows = periodDates.map((date, i) => {
    const e = entries[date]
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc'
    const d = new Date(date + 'T00:00:00Z')
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
    const cell = `background-color:${bg};padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0`
    if (!e || calcHours(e) === 0) {
      return `<tr><td style="${cell};color:#1e2a4a">${label}</td><td style="${cell};color:#cbd5e1;text-align:center">-</td><td style="${cell};color:#cbd5e1;text-align:center">-</td><td style="${cell};color:#cbd5e1;text-align:center">-</td><td style="${cell};color:#cbd5e1;text-align:right">-</td></tr>`
    }
    const hrs = calcHours(e); totalHrs += hrs
    const inOut = e.hours != null ? '<td style="'+cell+';color:#94a3b8;text-align:center">—</td><td style="'+cell+';color:#94a3b8;text-align:center">—</td>' : `<td style="${cell};color:#475569;text-align:center">${fmt12(e.start)}</td><td style="${cell};color:#475569;text-align:center">${fmt12(e.end)}</td>`
    return `<tr><td style="${cell};color:#1e2a4a;font-weight:600">${label}</td>${inOut}<td style="${cell};color:#1e2a4a;font-weight:700;text-align:center">${hrs.toFixed(2)} hrs</td><td style="${cell};color:#16a34a;font-weight:700;text-align:right">$${(hrs*rate).toFixed(2)}</td></tr>`
  }).join('')

  const gen = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#22c55e;height:6px;font-size:1px">&nbsp;</td></tr>
<tr><td style="background:#1e2a4a;padding:24px 32px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="38" height="38" align="center" valign="middle" style="background:#22c55e;border-radius:8px;width:38px;height:38px"><span style="color:#1e2a4a;font-size:24px;font-weight:900;font-family:Arial Black,Arial,sans-serif;line-height:38px;display:block;text-align:center">i</span></td>
      <td style="padding-left:12px" valign="middle"><div style="color:#fff;font-size:18px;font-weight:700">iCANS</div><div style="color:rgba(255,255,255,0.5);font-size:11px">Timesheet</div></td>
    </tr></table></td>
    <td align="right" valign="middle">
      <div style="color:rgba(255,255,255,0.5);font-size:9px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Pay Period</div>
      <div style="color:#fff;font-size:22px;font-weight:800">${range}</div>
      <div style="margin-top:6px"><span style="background:#22c55e;color:#1e2a4a;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">${name} &nbsp;|&nbsp; $${Number(rate).toFixed(2)}/hr</span></div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0"><p style="margin:0 0 8px;font-size:15px;color:#1e2a4a;font-weight:600">Hi Katherine,</p><p style="margin:0;font-size:14px;color:#475569;line-height:1.7">Here is my timesheet for <strong style="color:#1e2a4a">${range}</strong>.<br/>The full timesheet is attached as a PDF.</p></td></tr>
<tr><td style="padding:20px 32px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0">
<tr style="background:#1e2a4a"><td style="padding:10px 14px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700">Date</td><td style="padding:10px 14px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">In</td><td style="padding:10px 14px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">Out</td><td style="padding:10px 14px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">Hours</td><td style="padding:10px 14px;font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:right">Amount</td></tr>
${rows}
<tr style="background:#1e2a4a"><td colspan="3" style="padding:12px 14px;font-size:13px;color:#fff;font-weight:700">Total</td><td style="padding:12px 14px;font-size:14px;color:#fff;font-weight:800;text-align:center">${totalHrs.toFixed(2)} hrs</td><td style="padding:12px 14px;font-size:16px;color:#22c55e;font-weight:800;text-align:right">$${(totalHrs*rate).toFixed(2)}</td></tr>
</table></td></tr>
<tr><td style="padding:0 32px 28px"><p style="margin:0;font-size:14px;color:#475569;line-height:1.8">Best,<br/><strong style="color:#1e2a4a;font-size:15px">${name}</strong></p></td></tr>
<tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0"><p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">iCANS &nbsp;&middot;&nbsp; icans.ai &nbsp;&middot;&nbsp; Generated ${gen}</p></td></tr>
<tr><td style="background:#22c55e;height:4px;font-size:1px">&nbsp;</td></tr>
</table></td></tr></table></body></html>`
}

// ── Send email for one user ───────────────────────────────────────────────────

async function sendTimesheetEmail(periodDates, entries, settings) {
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  const gmail = google.gmail({ version: 'v1', auth })

  const range = fmtRange(periodDates)
  const [pdfBuf, html] = await Promise.all([
    generatePDF(periodDates, entries, settings),
    Promise.resolve(buildEmailHTML(periodDates, entries, settings, range))
  ])

  const boundary = 'bnd_' + Date.now()
  const pdfB64 = pdfBuf.toString('base64').match(/.{1,76}/g).join('\r\n')
  const htmlB64 = Buffer.from(html, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n')
  const filename = `Timesheet_${settings.name.replace(/\s+/g,'_')}_${periodDates[0]}_${periodDates[6]}.pdf`
  const to = settings.katherineEmail || process.env.KATHERINE_EMAIL

  const raw = [
    `From: ${process.env.GMAIL_FROM}`,
    `To: ${to}`,
    `Subject: Timesheet ${range} - ${settings.name}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    htmlB64,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    pdfB64,
    '',
    `--${boundary}--`
  ].join('\r\n')

  return gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } })
}

// ── Push to all subs for a user ───────────────────────────────────────────────

async function pushToUser(userEmail, title, body) {
  const keys = await kv.keys(`push_sub:${userEmail}:*`)
  if (!keys.length) {
    // Fallback: try old unkeyed subs
    const oldKeys = await kv.keys('push_sub:*')
    keys.push(...oldKeys)
  }
  const payload = JSON.stringify({ title, body })
  await Promise.allSettled(keys.map(async (key) => {
    const rec = await kv.get(key)
    if (!rec?.subscription) return
    try {
      await webpush.sendNotification(rec.subscription, payload)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) await kv.del(key)
    }
  }))
}

// ── Cron handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const today = todayCST()
  const thursdayStr = getThursdayOf(today)
  const periodDates = getPayPeriod(thursdayStr)
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay()

  // Get all registered users
  const userEmails = (await kv.smembers('users')) || []
  // Always include Dani as fallback
  if (!userEmails.includes('dani@icans.ai')) userEmails.push('dani@icans.ai')

  const results = { users: userEmails.length, today, dayOfWeek: todayDow }

  for (const email of userEmails) {
    const settings = await kv.get(`settings:${email}`) || { name: 'Dani', email, rate: 25, katherineEmail: 'katherine@icans.ai' }
    const record = await kv.get(`entries:${email}:${thursdayStr}`)
    const entries = record?.entries || {}

    // Thursday: auto-send timesheet email
    if (todayDow === 4) {
      try {
        await sendTimesheetEmail(periodDates, entries, settings)
        await pushToUser(email, '📬 Timesheet Sent!', `Your timesheet for this week was automatically emailed to Katherine.`)
        results[email] = 'sent'
      } catch (err) {
        console.error(`Failed to send timesheet for ${email}:`, err.message)
        await pushToUser(email, '⚠️ Timesheet Not Sent', 'Auto-send failed. Open the app to submit manually.')
        results[email] = 'error: ' + err.message
      }
    }

    // Mon-Fri: missing time reminder
    if (todayDow >= 1 && todayDow <= 5) {
      const todayEntry = entries[today]
      const hasEntry = todayEntry?.hours > 0 || (todayEntry?.start && todayEntry?.end)
      if (!hasEntry) {
        const dayName = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
        await pushToUser(email, '⏱ Missing Time Entry', `You haven't logged your hours for ${dayName} yet.`)
      }
    }
  }

  return res.status(200).json({ success: true, ...results })
}
