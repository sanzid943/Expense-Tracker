
// CSV & PDF export helpers

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function transactionsToCSV(transactions) {
  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Recurring'];
  const rows = transactions.map(t => [
    t.date, t.type, t.category, (t.description || '').replace(/,/g, ';'), t.amount, t.recurring ? 'Yes' : 'No'
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  return csv;
}

function exportTransactionsCSV(transactions, filename = 'transactions.csv') {
  downloadBlob(transactionsToCSV(transactions), filename, 'text/csv');
}

function exportTransactionsPDF(transactions, title, filename = 'transactions.pdf') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 25);

  let y = 36;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text('Date', 14, y);
  doc.text('Type', 44, y);
  doc.text('Category', 70, y);
  doc.text('Description', 105, y);
  doc.text('Amount', 180, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(220);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFontSize(9);
  transactions.forEach(t => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(t.date), 14, y);
    doc.text(String(t.type), 44, y);
    doc.text(String(t.category).slice(0, 16), 70, y);
    doc.text(String(t.description || '').slice(0, 30), 105, y);
    doc.text((t.type === 'expense' ? '-' : '+') + Number(t.amount).toFixed(2), 180, y, { align: 'right' });
    y += 7;
  });

  doc.save(filename);
}

function exportReportPDF(report, currencySymbol) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(`Financial Report — ${report.month}`, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(`Income: ${currencySymbol}${report.income.toFixed(2)}`, 14, 32);
  doc.text(`Expense: ${currencySymbol}${report.expense.toFixed(2)}`, 14, 39);
  doc.text(`Balance: ${currencySymbol}${report.balance.toFixed(2)}`, 14, 46);

  let y = 58;
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text('Category Breakdown', 14, y);
  y += 8;
  doc.setFontSize(10);
  report.categoryBreakdown.forEach(c => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(c.category, 14, y);
    doc.text(`${currencySymbol}${c.total.toFixed(2)}`, 180, y, { align: 'right' });
    y += 6;
  });

  y += 6;
  doc.setFontSize(13);
  doc.text('Transactions', 14, y);
  y += 8;
  doc.setFontSize(9);
  report.transactions.forEach(t => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${t.date}  ${t.type}  ${t.category}  ${t.description || ''}`, 14, y);
    doc.text((t.type === 'expense' ? '-' : '+') + Number(t.amount).toFixed(2), 196, y, { align: 'right' });
    y += 6;
  });

  doc.save(`report-${report.month}.pdf`);
}
