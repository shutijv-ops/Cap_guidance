// Bridge to wire report export buttons to available implementations
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printReportBtn');
  const downloadBtn = document.getElementById('downloadPdfBtn');

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      // Prefer modern window.printReport, fallback to legacy global printReport
      if (typeof window.printReport === 'function') return window.printReport();
      if (typeof printReport === 'function') return printReport();
      alert('Print not available in this build.');
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (typeof window.downloadReportPdf === 'function') return window.downloadReportPdf();
      // fallback: if legacy printReport creates PDF via html2pdf, call it
      if (typeof printReport === 'function') return printReport();
      alert('PDF download not available in this build.');
    });
  }
});
