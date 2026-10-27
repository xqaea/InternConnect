function initStudentTaskDetail({go, session, toast, exportStudentPdf}){
  function renderHighlight(){
    const ta=document.getElementById('reportTextarea'), out=document.getElementById('highlightPreview'); if(!ta||!out)return;
    const keywords=['assisted','tested','fixed','attended','developed','completed','implemented','refactored','reviewed','logged','retested','designed','created','built','debugged','documented','deployed','configured','updated','resolved','helped','learned'];
    const raw=ta.value||'';
    out.innerHTML=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').split('\n').map(line=>{
      const yes=keywords.some(k=>line.toLowerCase().includes(k));
      if(!yes || !line.trim()) return line; const lead=line.match(/^\s*/)[0]; return lead+'<span class="highlight-mark">'+line.slice(lead.length)+'</span>';
    }).join('\n');
  }
  function initTaskDetail(){
    const taskData={
      week5:{title:'Week 5 Accomplishment Report',instructions:'Summarize your work for Sept 15–19. Include hours rendered and key tasks completed.',due:'Due Sept 19, 11:59 PM'},
      week4:{title:'Week 4 Accomplishment Report',instructions:'Summarize your work for Sept 8–12.',due:'Due Sept 12, 11:59 PM · Verified'}
    };
    const params=new URLSearchParams(location.search); const t=taskData[params.get('task')]||taskData.week5;
    if(document.getElementById('taskDetailTitle')){
      document.getElementById('taskDetailTitle').textContent=t.title;
      document.getElementById('taskDetailInstructions').textContent=t.instructions;
      document.getElementById('taskDetailDue').innerHTML='<i class="fa-regular fa-calendar mr-1"></i>'+t.due;
    }
    const ta=document.getElementById('reportTextarea');
    ta?.addEventListener('input',renderHighlight);
    ta?.addEventListener('keydown',function(e){ if(e.key==='Tab'){e.preventDefault(); const s=this.selectionStart,en=this.selectionEnd;this.value=this.value.substring(0,s)+'\t'+this.value.substring(en);this.selectionStart=this.selectionEnd=s+1;renderHighlight();}});
    document.getElementById('backToClassworkBtn')?.addEventListener('click',()=>go('classwork'));
    const report = () => {
      const raw = ta?.value.trim() || '';
      if(!raw){ toast('Write your report first.', 'warn'); return null; }
      return {title: document.getElementById('taskDetailTitle').textContent, raw, name: (session() || {}).name || 'Student'};
    };
    document.getElementById('genPdfBtn')?.addEventListener('click',()=>{
      const r = report(); if(!r) return;
      exportStudentPdf('Accomplishment_Report_' + fileSlug(r.name) + '_' + fileSlug(r.title) + '.pdf', r.title, [['Student', r.name], ['Date', todayISO()], ['Report', r.raw]]);
    });
    document.getElementById('genWordBtn')?.addEventListener('click',()=>{
      const r = report(); if(!r) return;
      const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif">'
        + '<h1>' + esc(r.title) + '</h1><p>' + esc(r.name) + ' · ' + todayISO() + '</p><h2>Accomplishment Report</h2><p>'
        + esc(r.raw).replace(/\r?\n/g, '<br>') + '</p></body></html>';
      const a = document.createElement('a');
      a.href = 'data:application/msword;charset=utf-8,' + encodeURIComponent('\ufeff' + html);
      a.download = 'Accomplishment_Report_' + fileSlug(r.name) + '_' + fileSlug(r.title) + '.doc';
      a.click();
    });
    renderHighlight();
  }
  initTaskDetail();
}

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'taskdetail' && window.ICCore?.student?.initTaskDetail) window.ICCore.student.initTaskDetail();
  }, { once: true });
})();
