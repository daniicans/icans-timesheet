import { useEffect, useState } from 'react'
import { generatePDFHTML } from '../utils/pdf.js'

export default function PDFPreview({ periodDates, entries, settings, onClose, onSendEmail, sending }) {
  const [downloading, setDownloading] = useState(false)
  const html = generatePDFHTML(periodDates, entries, settings)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodDates, entries, settings })
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Timesheet_${periodDates[0]}_${periodDates[6]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // fallback: open HTML in new tab for print-to-PDF
      const blob = new Blob([html], { type: 'text/html' })
      window.open(URL.createObjectURL(blob))
    } finally {
      setDownloading(false)
    }
  }

  async function handleEmail() {
    await onSendEmail()
  }

  return (
    <div className="pdf-overlay">
      <div className="pdf-topbar">
        <span className="pdf-title">📄 PDF Preview</span>
        <div className="pdf-actions">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-outline-white" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Generating…' : '⬇ Download PDF'}
          </button>
          <button className="btn-primary" onClick={handleEmail} disabled={sending}>
            {sending ? 'Sending…' : '📤 Email Katherine'}
          </button>
        </div>
      </div>
      <div className="pdf-scroll">
        <div className="pdf-iframe-wrap" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
