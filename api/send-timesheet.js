import { google } from 'googleapis'

function calcHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

function fmt12(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

function buildEmailBody(periodDates, entries, settings, range) {
  const { name, rate } = settings
  let totalHrs = 0
  const lines = periodDates.map((date) => {
    const e = entries[date]
    const label = fmtDate(date).padEnd(26)
    if (!e?.start || !e?.end) return `  ${label}  —`
    const hrs = calcHours(e.start, e.end)
    totalHrs += hrs
    const amt = (hrs * rate).toFixed(2)
    return `  ${label}  ${fmt12(e.start)} – ${fmt12(e.end)}   (${hrs.toFixed(2)} hrs)   $${amt}`
  }).join('\n')

  return `Hi Katherine,

Here is my timesheet for ${range}.

Summary:
${lines}

Total Hours:  ${totalHrs.toFixed(2)} hrs
Total Amount: $${(totalHrs * rate).toFixed(2)}

The full timesheet is attached.

Best,
${name}`
}

function generatePDFHTML(periodDates, entries, settings, range) {
  const { name, rate } = settings
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  let totalHrs = 0

  const rows = periodDates.map((date) => {
    const e = entries[date]
    const d = new Date(date + 'T00:00:00')
    const label = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
    if (!e?.start || !e?.end) {
      return `<tr><td>${label}</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td></tr>`
    }
    const hrs = calcHours(e.start, e.end)
    totalHrs += hrs
    return `<tr><td>${label}</td><td>${fmt12(e.start)}</td><td>${fmt12(e.end)}</td><td>${hrs.toFixed(2)} hrs</td><td class="amount">$${(hrs * rate).toFixed(2)}</td></tr>`
  }).join('')

  const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Timesheet ${range}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;color:#1e2a4a;background:#fff;padding:40px;max-width:860px;margin:0 auto}.top-bar{height:5px;background:#22c55e;border-radius:3px;margin-bottom:32px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}.logo{width:36px;height:36px;background:#1e2a4a;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#22c55e;font-size:20px;font-weight:800;margin-right:10px}.brand{display:flex;align-items:center}.brand-text{font-size:18px;font-weight:700}.brand-sub{font-size:12px;color:#64748b}.meta{text-align:right}.period-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px}.period-range{font-size:20px;font-weight:700}.rate-chip{display:inline-block;background:#dcfce7;color:#16a34a;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;margin-top:4px}table{width:100%;border-collapse:collapse;margin-bottom:32px}thead tr{background:#1e2a4a;color:#fff}thead th{padding:12px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:11px 16px;font-size:14px;border-bottom:1px solid #e2e8f0}td.empty{color:#94a3b8}td.amount{font-weight:600}tfoot tr{background:#1e2a4a;color:#fff}tfoot td{padding:14px 16px;font-size:14px;font-weight:600}tfoot td.total-amt{font-size:18px;color:#22c55e;font-weight:800}.signature{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0}.sig-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;display:block;margin-bottom:32px}.sig-line{border-bottom:1.5px solid #1e2a4a;width:220px;margin-bottom:6px}.sig-name{font-size:13px;color:#475569}.generated{text-align:right;font-size:12px;color:#94a3b8;line-height:1.6}</style>
</head><body>
<div class="top-bar"></div>
<div class="header">
  <div class="brand"><div class="logo">i</div><div><div class="brand-text">iCANS</div><div class="brand-sub">Timesheet</div></div></div>
  <div class="meta"><div class="period-label">Pay Period</div><div class="period-range">${range}</div><div style="font-size:13px;color:#475569;margin-top:4px">${name}</div><div class="rate-chip">$${Number(rate).toFixed(2)}/hr</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th><th>Amount</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="3"><strong>Total</strong></td><td>${totalHrs.toFixed(2)} hrs</td><td class="total-amt">$${(totalHrs * rate).toFixed(2)}</td></tr></tfoot>
</table>
<div class="signature">
  <div><span class="sig-label">Employee Signature</span><div class="sig-line"></div><div class="sig-name">${name} · Date: ___________</div></div>
  <div class="generated">Generated ${generated}<br/>iCANS · icans.ai</div>
</div>
</body></html>`
}

function fmtRange(dates) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const s = new Date(dates[0] + 'T00:00:00')
  const e = new Date(dates[6] + 'T00:00:00')
  if (s.getMonth() === e.getMonth()) return `${months[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`
}

function makeRawEmail({ to, from, subject, body, attachmentName, attachmentContent }) {
  const boundary = 'boundary_icans_ts_' + Date.now()
  const attachB64 = Buffer.from(attachmentContent).toString('base64')
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: text/html; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    attachB64,
    '',
    `--${boundary}--`
  ].join('\r\n')
  return Buffer.from(raw).toString('base64url')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { periodDates, entries, settings } = req.body
  if (!periodDates || !entries || !settings) return res.status(400).json({ error: 'Missing fields' })

  try {
    const auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    )
    auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

    const gmail = google.gmail({ version: 'v1', auth })
    const range = fmtRange(periodDates)
    const html = generatePDFHTML(periodDates, entries, settings, range)
    const body = buildEmailBody(periodDates, entries, settings, range)
    const start = periodDates[0]
    const end = periodDates[6]
    const attachmentName = `Timesheet_${start}_${end}.html`

    const raw = makeRawEmail({
      to: process.env.KATHERINE_EMAIL,
      from: process.env.GMAIL_FROM,
      subject: `Timesheet ${range}`,
      body,
      attachmentName,
      attachmentContent: html
    })

    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return res.status(200).json({ success: true, messageId: result.data.id })
  } catch (err) {
    console.error('send-timesheet error:', err)
    return res.status(500).json({ error: err.message })
  }
}
