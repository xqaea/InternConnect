// One accomplishment report as PDF.
function currentReport(){
    const t = taskInfo(currentTaskId), sub = t.submissions[currentSubIndex];
    return {t, sub, grade: getGrades()[gradeKey(currentTaskId, sub.databaseReport?sub.email:sub.name)]};
}
const reportName = (r, ext) => 'Accomplishment_Report_' + fileSlug(r.sub.name) + '_' + fileSlug(r.t.title) + '.' + ext;
on('td-genPdfBtn', 'click', () => {
    const lib = window.jspdf && window.jspdf.jsPDF;
    if(!lib){ showToast('The PDF library could not load (are you offline?). Please try again.', 'warn'); return; }
    const r = currentReport(), doc = new lib({unit: 'pt', format: 'a4'});
    const css = getComputedStyle(document.documentElement);
    const rgb = (name, fallback) => { const h = css.getPropertyValue(name).trim().replace('#', ''); return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)) : fallback; };
    const dark = rgb('--bd', [15, 23, 42]), accent = rgb('--b600', [2, 132, 199]);
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, width = W - M * 2;
    let y = drawExportHeader(doc, r.t.title, ['Accomplishment report  |  ' + r.sub.name], M);
    const line = (text, size, bold, color, gap) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
        doc.splitTextToSize(cleanText(text), width).forEach(l => {
            if(y > H - 56){ doc.addPage(); y = M; doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); }
            doc.text(l, M, y); y += size * 1.45;
        });
        y += gap || 0;
    };
    line(r.sub.meta || '', 10, false, [100, 116, 139], 4);
    line('Status: ' + r.sub.status + (r.sub.late ? ' (late)' : ''), 10, true, [30, 41, 59], 14);
    line('ACCOMPLISHMENT REPORT', 9, true, accent, 2);
    line(r.sub.raw || '', 11, false, [30, 41, 59], 14);
    line('RESUME BULLET', 9, true, accent, 2);
    line(r.sub.bullet || '', 11, false, [30, 41, 59], 14);
    if(r.grade || r.sub.feedback){
        line('GRADE AND FEEDBACK', 9, true, accent, 2);
        if(r.grade) line('Grade: ' + r.grade.score + ' / ' + r.t.maxPoints, 11, true, [30, 41, 59], 2);
        const fb = r.sub.feedback || (r.grade && r.grade.feedback);
        if(fb) line(fb, 11, false, [30, 41, 59], 0);
    }
    const pages = doc.getNumberOfPages();
    for(let i = 1; i <= pages; i++){
        doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 130, 145);
        doc.text('InternConnect  |  ' + todayISO(), M, H - 24); doc.text('Page ' + i + ' of ' + pages, W - M, H - 24, {align: 'right'});
    }
    doc.save(reportName(r, 'pdf'));
    logAudit('Exported the accomplishment report of ' + r.sub.name + ' (' + r.t.title + ') as PDF');
    showToast('PDF of ' + r.sub.name + "'s report downloaded.", 'success');
});
