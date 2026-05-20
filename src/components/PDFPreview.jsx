import { useEffect } from 'react'
import { generatePDFHTML, downloadPDF } from '../utils/pdf.js'

export default function PDFPreview({ periodDates, entries, settings, onClose, onSendEmail, sending }) {
  const html = generatePDFHTML(periodDates, entries, settings)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleDownloadAndEmail() {
    downloadPDF(periodDates, entries, settings)
    onSendEmail()
  }

  return (
    <div className="pdf-overlay">
      <div className="pdf-topbar">
        <span className="pdf-title">📄 PDF Preview</span>
        <div className="pdf-actions">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button
            className="btn-primary"
            onClick={handleDownloadAndEmail}
            disabled={sending}
          >
            {sending ? 'Sending…' : 'Download + Email →'}
          </button>
        </div>
      </div>
      <div className="pdf-scroll">
        <div
          className="pdf-iframe-wrap"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
