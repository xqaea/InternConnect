  function exportStudentDocumentPdf(filename, title, sections, toast){
    const Pdf = window.jspdf?.jsPDF;
    if(!Pdf) return toast('The PDF library could not load. Please check your connection and try again.', 'warn');
    const doc = new Pdf({unit:'pt', format:'a4'}), width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const margin = 48, lineWidth = width - margin * 2;
    addExportLogo(doc);
    doc.setTextColor(15, 23, 42);
    let y = 108;
    const line = (value, size, bold, gap) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      String(value || '').split('\n').forEach(part => {
        (doc.splitTextToSize(part || ' ', lineWidth) || [' ']).forEach(text => {
          if(y > height - 54){ doc.addPage(); y = 54; }
          doc.text(text, margin, y); y += size * 1.45;
        });
      });
      y += gap;
    };
    line(title, 17, true, 12);
    sections.forEach(([heading, value]) => {
      if(!String(value || '').trim()) return;
      // Keep the section heading with at least the first two lines of content.
      if(y + 65 > height - 54){ doc.addPage(); y = 54; }
      line(heading.toUpperCase(), 11, true, 5);
      line(value, 11, false, 13);
    });
    doc.save(filename);
  }
