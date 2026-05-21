import { google } from 'googleapis'
import PDFDocument from 'pdfkit'

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

function fmtLongDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtRange(dates) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const s = new Date(dates[0] + 'T00:00:00')
  const e = new Date(dates[6] + 'T00:00:00')
  if (s.getMonth() === e.getMonth()) return `${months[s.getMonth()]} ${s.getDate()} - ${e.getDate()}`
  return `${months[s.getMonth()]} ${s.getDate()} - ${months[e.getMonth()]} ${e.getDate()}`
}

// ── Real PDF via pdfkit ──────────────────────────────────────────────────────
async function generatePDF(periodDates, entries, settings) {
  const { name, rate } = settings
  const range = fmtRange(periodDates)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const NAVY = '#1e2a4a'
    const GREEN = '#22c55e'
    const GRAY = '#64748b'
    const LIGHT = '#f8fafc'
    const W = doc.page.width - 100 // usable width

    // Green top bar
    doc.rect(50, 30, W, 5).fill(GREEN)

    // Logo mark
    doc.roundedRect(50, 50, 36, 36, 6).fill(NAVY)
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(22).text('i', 50, 57, { width: 36, align: 'center' })

    // Brand name
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text('iCANS', 96, 52)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text('Timesheet', 96, 70)

    // Period info (right side)
    const rightX = 370
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('PAY PERIOD', rightX, 52)
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(range, rightX, 64)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text(name, rightX, 84)

    // Rate chip
    doc.roundedRect(rightX, 97, 70, 16, 4).fill('#dcfce7')
    doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9).text(`$${Number(rate).toFixed(2)}/hr`, rightX + 4, 101)

    // Table starts
    let y = 130

    // Table header
    const cols = { date: 50, in: 240, out: 320, hrs: 400, amt: 460 }
    doc.rect(50, y, W, 22).fill(NAVY)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    doc.text('DATE', cols.date + 4, y + 7)
    doc.text('TIME IN', cols.in, y + 7)
    doc.text('TIME OUT', cols.out, y + 7)
    doc.text('HOURS', cols.hrs, y + 7)
    doc.text('AMOUNT', cols.amt, y + 7)
    y += 22

    let totalHrs = 0
    periodDates.forEach((date, i) => {
      const e = entries[date]
      const rowH = 22
      if (i % 2 === 1) doc.rect(50, y, W, rowH).fill(LIGHT)

      const d = new Date(date + 'T00:00:00')
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

      doc.fillColor(NAVY).font('Helvetica').fontSize(10).text(dayLabel, cols.date + 4, y + 6)

      if (e?.start && e?.end) {
        const hrs = calcHours(e.start, e.end)
        totalHrs += hrs
        const amt = hrs * rate
        doc.text(fmt12(e.start), cols.in, y + 6)
        doc.text(fmt12(e.end), cols.out, y + 6)
        doc.font('Helvetica-Bold').text(`${hrs.toFixed(2)} hrs`, cols.hrs, y + 6)
        doc.fillColor(GREEN).text(`$${amt.toFixed(2)}`, cols.amt, y + 6)
      } else {
        doc.fillColor(GRAY).text('—', cols.in, y + 6)
        doc.text('—', cols.out, y + 6)
        doc.text('—', cols.hrs, y + 6)
        doc.text('—', cols.amt, y + 6)
      }
      y += rowH
    })

    // Total row
    doc.rect(50, y, W, 26).fill(NAVY)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
    doc.text('TOTAL', cols.date + 4, y + 7)
    doc.text(`${totalHrs.toFixed(2)} hrs`, cols.hrs, y + 7)
    doc.fillColor(GREEN).fontSize(13).text(`$${(totalHrs * rate).toFixed(2)}`, cols.amt, y + 5)
    y += 40

    // Signature line
    doc.moveTo(50, y + 30).lineTo(260, y + 30).strokeColor('#cbd5e1').lineWidth(1).stroke()
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Employee Signature', 50, y + 35)
    doc.text(`${name} · Date: ___________`, 50, y + 47)

    // Generated note
    const gen = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    doc.fillColor(GRAY).fontSize(8)
      .text(`Generated ${gen}`, 380, y + 35, { align: 'right', width: W - 330 })
      .text('iCANS · icans.ai', 380, y + 46, { align: 'right', width: W - 330 })

    doc.end()
  })
}

// ── Branded HTML email body ──────────────────────────────────────────────────
function buildEmailHTML(periodDates, entries, settings, range) {
  const { name, rate } = settings
  let totalHrs = 0

  const rows = periodDates.map((date) => {
    const e = entries[date]
    const d = new Date(date + 'T00:00:00')
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const bg = periodDates.indexOf(date) % 2 === 0 ? '#ffffff' : '#f8fafc'

    const cellBase = `background-color:${bg};padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0`
    if (!e?.start || !e?.end) {
      return `<tr>
        <td style="${cellBase};color:#1e2a4a">${dayLabel}</td>
        <td style="${cellBase};color:#cbd5e1;text-align:center">-</td>
        <td style="${cellBase};color:#cbd5e1;text-align:center">-</td>
        <td style="${cellBase};color:#cbd5e1;text-align:center">-</td>
        <td style="${cellBase};color:#cbd5e1;text-align:right">-</td>
      </tr>`
    }
    const hrs = calcHours(e.start, e.end)
    totalHrs += hrs
    return `<tr>
      <td style="${cellBase};color:#1e2a4a;font-weight:600">${dayLabel}</td>
      <td style="${cellBase};color:#475569;text-align:center">${fmt12(e.start)}</td>
      <td style="${cellBase};color:#475569;text-align:center">${fmt12(e.end)}</td>
      <td style="${cellBase};color:#1e2a4a;font-weight:700;text-align:center">${hrs.toFixed(2)} hrs</td>
      <td style="${cellBase};color:#16a34a;font-weight:700;text-align:right">$${(hrs * rate).toFixed(2)}</td>
    </tr>`
  }).join('')

  const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff">

  <!-- Green top bar -->
  <tr><td style="background:#22c55e;height:6px;font-size:1px;line-height:1px">&nbsp;</td></tr>

  <!-- Navy header -->
  <tr><td style="background:#1e2a4a;padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <!-- Logo + brand -->
        <td valign="middle">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="38" height="38" align="center" valign="middle" style="background:#22c55e;border-radius:8px;width:38px;height:38px">
                <span style="color:#1e2a4a;font-size:24px;font-weight:900;font-family:Arial Black,Arial,sans-serif;line-height:38px;display:block;text-align:center">i</span>
              </td>
              <td style="padding-left:12px" valign="middle">
                <div style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.1;margin:0">iCANS</div>
                <div style="color:rgba(255,255,255,0.5);font-size:11px;margin:2px 0 0">Timesheet</div>
              </td>
            </tr>
          </table>
        </td>
        <!-- Pay period -->
        <td align="right" valign="middle">
          <div style="color:rgba(255,255,255,0.5);font-size:9px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Pay Period</div>
          <div style="color:#ffffff;font-size:22px;font-weight:800;line-height:1.1">${range}</div>
          <div style="margin-top:6px">
            <span style="background:#22c55e;color:#1e2a4a;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">${name} &nbsp;|&nbsp; $${Number(rate).toFixed(2)}/hr</span>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:28px 32px 0">
    <p style="margin:0 0 8px;font-size:15px;color:#1e2a4a;font-weight:600">Hi Katherine,</p>
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.7">
      Here is my timesheet for <strong style="color:#1e2a4a">${range}</strong>.<br/>
      The full timesheet is attached as a PDF.
    </p>
  </td></tr>

  <!-- Table -->
  <tr><td style="padding:20px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0">
      <!-- Header row -->
      <tr style="background:#1e2a4a">
        <td style="padding:10px 14px;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700">Date</td>
        <td style="padding:10px 14px;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">In</td>
        <td style="padding:10px 14px;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">Out</td>
        <td style="padding:10px 14px;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:center">Hours</td>
        <td style="padding:10px 14px;font-size:10px;color:#ffffff;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;text-align:right">Amount</td>
      </tr>
      ${rows}
      <!-- Total row -->
      <tr style="background:#1e2a4a">
        <td colspan="3" style="padding:12px 14px;font-size:13px;color:#ffffff;font-weight:700">Total</td>
        <td style="padding:12px 14px;font-size:14px;color:#ffffff;font-weight:800;text-align:center">${totalHrs.toFixed(2)} hrs</td>
        <td style="padding:12px 14px;font-size:16px;color:#22c55e;font-weight:800;text-align:right">$${(totalHrs * rate).toFixed(2)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Sign-off -->
  <tr><td style="padding:0 32px 28px">
    <p style="margin:0;font-size:14px;color:#475569;line-height:1.8">Best,<br/><strong style="color:#1e2a4a;font-size:15px">${name}</strong></p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">
      iCANS &nbsp;&middot;&nbsp; icans.ai &nbsp;&middot;&nbsp; Generated ${generated}
    </p>
  </td></tr>

  <!-- Bottom green bar -->
  <tr><td style="background:#22c55e;height:4px;font-size:1px;line-height:1px">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function encodeSubject(subject) {
  // RFC 2047: encode any non-ASCII characters so email clients don't mangle them
  if (/^[\x00-\x7F]*$/.test(subject)) return subject
  return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
}

function makeRawEmail({ to, from, subject, htmlBody, pdfBuffer, attachmentName }) {
  const boundary = 'boundary_icans_ts_' + Date.now()
  // Encode both parts as base64 so no encoding mismatch can corrupt the content
  const htmlB64 = Buffer.from(htmlBody, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n')
  const pdfB64 = pdfBuffer.toString('base64').match(/.{1,76}/g).join('\r\n')

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
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
    `Content-Type: application/pdf; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    pdfB64,
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
    const start = periodDates[0]
    const end = periodDates[6]

    const [pdfBuffer, htmlBody] = await Promise.all([
      generatePDF(periodDates, entries, settings),
      Promise.resolve(buildEmailHTML(periodDates, entries, settings, range))
    ])

    const raw = makeRawEmail({
      to: process.env.KATHERINE_EMAIL,
      from: process.env.GMAIL_FROM,
      subject: `Timesheet ${range}`,
      htmlBody,
      pdfBuffer,
      attachmentName: `Timesheet_${start}_${end}.pdf`
    })

    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return res.status(200).json({ success: true, messageId: result.data.id })
  } catch (err) {
    console.error('send-timesheet error:', err)
    return res.status(500).json({ error: err.message })
  }
}
