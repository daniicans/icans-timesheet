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

function fmtRange(dates) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const s = new Date(dates[0] + 'T00:00:00')
  const e = new Date(dates[6] + 'T00:00:00')
  if (s.getMonth() === e.getMonth()) return `${months[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`
}

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
    const W = doc.page.width - 100

    doc.rect(50, 30, W, 5).fill(GREEN)

    doc.roundedRect(50, 50, 36, 36, 6).fill(NAVY)
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(22).text('i', 50, 57, { width: 36, align: 'center' })

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text('iCANS', 96, 52)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text('Timesheet', 96, 70)

    const rightX = 370
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('PAY PERIOD', rightX, 52)
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(range, rightX, 64)
    doc.fillColor(GRAY).font('Helvetica').fontSize(10).text(name, rightX, 84)
    doc.roundedRect(rightX, 97, 70, 16, 4).fill('#dcfce7')
    doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(9).text(`$${Number(rate).toFixed(2)}/hr`, rightX + 4, 101)

    let y = 130
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
        doc.text(fmt12(e.start), cols.in, y + 6)
        doc.text(fmt12(e.end), cols.out, y + 6)
        doc.font('Helvetica-Bold').text(`${hrs.toFixed(2)} hrs`, cols.hrs, y + 6)
        doc.fillColor(GREEN).text(`$${(hrs * rate).toFixed(2)}`, cols.amt, y + 6)
      } else {
        doc.fillColor(GRAY).text('—', cols.in, y + 6).text('—', cols.out, y + 6).text('—', cols.hrs, y + 6).text('—', cols.amt, y + 6)
      }
      y += rowH
    })

    doc.rect(50, y, W, 26).fill(NAVY)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('TOTAL', cols.date + 4, y + 7)
    doc.text(`${totalHrs.toFixed(2)} hrs`, cols.hrs, y + 7)
    doc.fillColor(GREEN).fontSize(13).text(`$${(totalHrs * rate).toFixed(2)}`, cols.amt, y + 5)
    y += 40

    doc.moveTo(50, y + 30).lineTo(260, y + 30).strokeColor('#cbd5e1').lineWidth(1).stroke()
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Employee Signature', 50, y + 35)
    doc.text(`${name} · Date: ___________`, 50, y + 47)

    const gen = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    doc.fillColor(GRAY).fontSize(8)
      .text(`Generated ${gen}`, 380, y + 35, { align: 'right', width: W - 330 })
      .text('iCANS · icans.ai', 380, y + 46, { align: 'right', width: W - 330 })

    doc.end()
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { periodDates, entries, settings } = req.body
  if (!periodDates || !entries || !settings) return res.status(400).json({ error: 'Missing fields' })

  try {
    const pdfBuffer = await generatePDF(periodDates, entries, settings)
    const start = periodDates[0]
    const end = periodDates[6]
    const filename = `Timesheet_${start}_${end}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)
  } catch (err) {
    console.error('generate-pdf error:', err)
    res.status(500).json({ error: err.message })
  }
}
