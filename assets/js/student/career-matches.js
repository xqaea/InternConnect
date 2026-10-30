/* Career suggestions use the saved resume; the resume itself is never modified. */
document.addEventListener('ic:student-ready',()=>{
  const button=document.getElementById('careerMatchesBtn');
  if(!button) return;
  const dialog=document.createElement('dialog');
  dialog.className='career-dialog bg-white rounded-xl border border-slate-200 shadow-xl p-0 text-slate-800';
  dialog.setAttribute('aria-labelledby','careerDialogTitle');
  dialog.innerHTML='<div class="p-5 border-b border-slate-200 flex items-start justify-between gap-4"><div><h2 id="careerDialogTitle" class="text-lg font-bold text-slate-900">Career suggestions</h2><p class="text-[12px] text-slate-500 mt-1">Based on your saved resume. <a href="resume-builder.html" class="text-sky-700 underline">Update your resume</a> to refresh your suggestions.</p></div><button type="button" data-career-close aria-label="Close career suggestions" class="w-9 h-9 shrink-0 rounded-md hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button></div>'
    +'<div class="p-5"><p class="text-[12px] text-slate-500 mb-4">Percentages show semantic alignment, not hiring probability or confirmed qualifications. Skills to explore are not listed directly in your saved skills; they may still be skills you have.</p><div data-career-results aria-live="polite"></div><button type="button" data-career-retry class="hidden mt-4 text-[12.5px] font-semibold text-sky-700 border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded-md px-4 py-2">Try again</button></div>';
  document.body.appendChild(dialog);
  const results=dialog.querySelector('[data-career-results]');
  const retry=dialog.querySelector('[data-career-retry]');
  let loading=false,controller=null;
  dialog.querySelector('[data-career-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>controller?.abort());
  const tags=list=>list.length?list.map(skill=>'<span class="inline-block text-[11px] text-slate-600 bg-slate-100 rounded-md px-2 py-1">'+esc(skill)+'</span>').join(' '):'<span class="text-[12px] text-slate-400">None listed</span>';
  async function load(){
    if(loading) return;
    const me=getJSON('ic_session',{}) || {};
    const resume=getJSON('ic_resume',{})[(me.email || me.name || '').toLowerCase()];
    retry.classList.add('hidden');
    if(!resume?.savedAt || !(resume.hard || []).length){
      results.innerHTML='<p class="text-[13px] text-slate-600">Save your resume with at least one technical skill, then explore careers.</p><a href="resume-builder.html" class="inline-block mt-3 text-[12.5px] font-semibold text-sky-700 underline">Open Resume Builder</a>';
      return;
    }
    loading=true;button.disabled=true;results.setAttribute('aria-busy','true');
    results.innerHTML='<div role="status" class="text-[13px] text-slate-500">Finding career suggestions… The first search may take a little longer.</div><div aria-hidden="true" class="mt-4 space-y-3">'+Array.from({length:3},()=>'<div class="h-24 rounded-lg bg-slate-100 border border-slate-200"></div>').join('')+'</div>';
    controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      const fields=resume.fields || {};
      const context=['ed-objective','ed-workexp','ed-education','ed-thesisTitle','ed-thesisRole'].map(id=>fields[id] || '').filter(Boolean);
      allTaskIds().forEach(id=>taskSubmissions(id).filter(report=>report.status==='Verified' && report.bullet && (report.email?report.email===me.email:report.name===me.name)).forEach(report=>context.push(report.bullet)));
      const base=String(window.IC_AI_API_BASE || (location.protocol==='https:'?'/ai-api':'http://'+(location.hostname || '127.0.0.1')+':8000')).replace(/\/$/,'');
      const response=await fetch(base+'/api/match/careers',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({student_skills:[...new Set([...(resume.hard || []),...(resume.soft || [])])].slice(0,200),resume_context:context.join('\n').slice(0,8000),limit:5})});
      const body=await response.json();
      if(!response.ok) throw new Error(typeof body.detail==='string'?body.detail:'Career suggestions could not be loaded.');
      const matches=body.matches || [];
      results.innerHTML=matches.length?'<div class="space-y-4">'+matches.map(match=>'<article class="border border-slate-200 rounded-lg p-4"><div class="flex items-start justify-between gap-3"><h3 class="font-semibold text-[14px] text-slate-900">'+esc(match.title)+'</h3><span class="text-[12px] font-semibold text-sky-700 whitespace-nowrap">'+esc(match.alignment_percent)+'% alignment</span></div><p class="text-[12px] text-slate-500 mt-2">'+esc(match.description)+'</p><ul class="list-disc pl-4 text-[12px] text-slate-600 space-y-1 mt-3">'+match.reasons.map(reason=>'<li>'+esc(reason)+'</li>').join('')+'</ul><p class="text-[11px] font-semibold text-slate-500 mt-3 mb-1">Listed skill matches</p><div class="flex flex-wrap gap-1">'+tags(match.matched_skills)+'</div><p class="text-[11px] font-semibold text-slate-500 mt-3 mb-1">Skills to explore</p><div class="flex flex-wrap gap-1">'+tags(match.skills_to_explore)+'</div></article>').join('')+'</div><p class="text-[11px] text-slate-400 mt-4">Career profiles: O*NET 31.0. Suggestions cover occupations, not current vacancies.</p>':'<p class="text-[13px] text-slate-600">No career suggestions are available for this resume yet.</p>';
    }catch(error){
      if(dialog.open){results.innerHTML='<p class="text-[13px] text-slate-600">'+esc(error.name==='AbortError'?'This search took too long. Please try again.':error.message==='Failed to fetch'?'Career matching is unavailable. Please try again when the service is running.':error.message)+'</p>';retry.classList.remove('hidden');}
    }finally{clearTimeout(timer);loading=false;button.disabled=false;results.removeAttribute('aria-busy');}
  }
  retry.addEventListener('click',load);
  button.addEventListener('click',()=>{dialog.showModal();load();});
},{once:true});
