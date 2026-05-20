import { getPayPeriod, calcHours, formatHours, formatTime12, formatShortDate, formatDisplayRange } from './time.js'

export function generatePDFHTML(periodDates, entries, settings) {
  const { name, rate } = settings
  const range = formatDisplayRange(periodDates[0])

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']

  let totalHrs = 0
  const rows = periodDates.map((date) => {
    const entry = entries[date]
    const d = new Date(date + 'T00:00:00')
    const label = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
    if (!entry?.start || !entry?.end) {
      return `<tr><td>${label}</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td></tr>`
    }
    const hrs = calcHours(entry.start, entry.end)
    totalHrs += hrs
    const amt = hrs * rate
    return `<tr>
      <td>${label}</td>
      <td>${formatTime12(entry.start)}</td>
      <td>${formatTime12(entry.end)}</td>
      <td>${formatHours(hrs)} hrs</td>
      <td class="amount">$${(amt).toFixed(2)}</td>
    </tr>`
  }).join('')

  const totalAmt = totalHrs * rate
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Timesheet ${range}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1e2a4a; background: #fff; padding: 40px; max-width: 860px; margin: 0 auto; }
  .top-bar { height: 5px; background: #22c55e; border-radius: 3px; margin-bottom: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 36px; height: 36px; background: #1e2a4a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #22c55e; font-size: 20px; font-weight: 800; }
  .brand-text { font-size: 18px; font-weight: 700; color: #1e2a4a; }
  .brand-sub { font-size: 12px; color: #64748b; }
  .meta { text-align: right; }
  .period-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
  .period-range { font-size: 20px; font-weight: 700; color: #1e2a4a; }
  .meta-details { font-size: 13px; color: #475569; margin-top: 6px; }
  .rate-chip { display: inline-block; background: #dcfce7; color: #16a34a; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  thead tr { background: #1e2a4a; color: #fff; }
  thead th { padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 11px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
  td.empty { color: #94a3b8; }
  td.amount { font-weight: 600; }
  tfoot tr { background: #1e2a4a; color: #fff; }
  tfoot td { padding: 14px 16px; font-size: 14px; font-weight: 600; }
  tfoot td.total-hrs { font-size: 16px; }
  tfoot td.total-amt { font-size: 18px; color: #22c55e; font-weight: 800; }
  .signature { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
  .sig-block label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; display: block; margin-bottom: 32px; }
  .sig-line { border-bottom: 1.5px solid #1e2a4a; width: 220px; margin-bottom: 6px; }
  .sig-name { font-size: 13px; color: #475569; }
  .generated { text-align: right; font-size: 12px; color: #94a3b8; line-height: 1.6; }
</style>
</head>
<body>
  <div class="top-bar"></div>
  <div class="header">
    <div class="brand">
      <div class="logo">i</div>
      <div>
        <div class="brand-text">iCANS</div>
        <div class="brand-sub">Timesheet</div>
      </div>
    </div>
    <div class="meta">
      <div class="period-label">Pay Period</div>
      <div class="period-range">${range}</div>
      <div class="meta-details">${name}</div>
      <div class="rate-chip">$${Number(rate).toFixed(2)}/hr</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time In</th>
        <th>Time Out</th>
        <th>Hours</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3"><strong>Total</strong></td>
        <td class="total-hrs">${formatHours(totalHrs)} hrs</td>
        <td class="total-amt">$${totalAmt.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="signature">
    <div class="sig-block">
      <label>Employee Signature</label>
      <div class="sig-line"></div>
      <div class="sig-name">${name} · Date: ___________</div>
    </div>
    <div class="generated">
      Generated ${generatedDate}<br/>
      iCANS · icans.ai
    </div>
  </div>
</body>
</html>`
}

export function downloadPDF(periodDates, entries, settings) {
  const html = generatePDFHTML(periodDates, entries, settings)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const start = periodDates[0]
  const end = periodDates[6]
  a.href = url
  a.download = `Timesheet_${start}_${end}.html`
  a.click()
  URL.revokeObjectURL(url)
}
