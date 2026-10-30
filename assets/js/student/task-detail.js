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
    const params=new URLSearchParams(location.search);
    const selected=findTask(params.get('task'));
    const me=session() || {};
    const t=selected && selected.classCode===me.classCode && selected.status!=='archived'?selected:null;
    if(document.getElementById('taskDetailTitle')){
      document.getElementById('taskDetailTitle').textContent=t?t.title:'Task unavailable';
      document.getElementById('taskDetailInstructions').textContent=t?(t.instructions || ''):'Select an available task from Classwork.';
      // Real task metadata and attachments are rendered by task-records.js.
      if(!t) document.getElementById('taskDetailDue').textContent='';
    }
    const ta=document.getElementById('reportTextarea');
    ta?.addEventListener('input',renderHighlight);
    ta?.addEventListener('keydown',function(e){ if(e.key==='Tab'){e.preventDefault(); const s=this.selectionStart,en=this.selectionEnd;this.value=this.value.substring(0,s)+'\t'+this.value.substring(en);this.selectionStart=this.selectionEnd=s+1;renderHighlight();}});
    document.getElementById('backToClassworkBtn')?.addEventListener('click',()=>go('classwork'));
    if(!t){
      if(ta){ta.value='';ta.disabled=true;}
      ['submitReportBtn'].forEach(id=>{const button=document.getElementById(id);if(button)button.disabled=true;});
      renderHighlight();
      return;
    }
    renderHighlight();
  }
  initTaskDetail();
}

(function () {
  'use strict';
  document.addEventListener('ic:student-ready', () => {
    if (document.body.dataset.page === 'taskdetail' && window.ICCore?.student?.initTaskDetail) window.ICCore.student.initTaskDetail();
  }, { once: true });
})();
