function initStudentResume({getJSON, setJSON, session, toast, exportStudentPdf}){
  // ---------------- Resume Builder ----------------
  function linesToListItems(text){
    return (text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => '<li>' + l.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</li>').join('');
  }
  function linesToParagraphLines(text){
    return (text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('<br>');
  }

  function renderResumePreview(){
    const get = id => document.getElementById(id);
    if(!get('pv-name')) return;
    get('pv-name').textContent = get('ed-name')?.value || 'Your Name';
    get('pv-contact').textContent = (get('ed-phone')?.value || '') + ' · ' + (get('ed-email')?.value || '');
    get('pv-objective').textContent = get('ed-objective')?.value || '';
    get('pv-education').textContent = get('ed-education')?.value || '';

    const work = get('ed-workexp')?.value.trim() || '';
    get('pv-workexp-wrap').style.display = work ? '' : 'none';
    get('pv-workexp').innerHTML = linesToParagraphLines(work);

    const soft = [...document.querySelectorAll('#softTagBox .tag-chip')].map(c => c.childNodes[0]?.textContent?.trim() || '').filter(Boolean);
    const hard = [...document.querySelectorAll('#techTagBox .tag-chip')].map(c => c.childNodes[0]?.textContent?.trim() || '').filter(Boolean);
    get('pv-softskills').textContent = soft.join(', ');
    get('pv-hardskills').textContent = hard.join(', ');

    const includeThesis = get('includeThesisToggle')?.checked;
    const thesisTitle = get('ed-thesisTitle')?.value.trim() || '';
    get('pv-projects-wrap').style.display = includeThesis && thesisTitle ? '' : 'none';
    get('pv-projects').textContent = thesisTitle + ((get('ed-thesisRole')?.value || '').trim() ? ' — ' + get('ed-thesisRole').value.trim() : '');

    const includeCerts = get('includeCertsToggle')?.checked;
    const certItems = [...document.querySelectorAll('#certRows > div')].map(row=>{
      const inputs=row.querySelectorAll('input');
      return inputs[0]?.value ? inputs[0].value + (inputs[1]?.value ? ' — ' + inputs[1].value : '') : '';
    }).filter(Boolean);
    get('pv-certs-wrap').style.display = includeCerts && certItems.length ? '' : 'none';
    get('pv-certs').innerHTML = certItems.map(x => '<li>'+x+'</li>').join('');

    const vol=get('ed-volunteer')?.value.trim()||'';
    get('pv-volunteer-wrap').style.display=vol?'':'none';
    get('pv-volunteer').innerHTML=linesToListItems(vol);
    const awards=get('ed-awards')?.value.trim()||'';
    get('pv-awards-wrap').style.display=awards?'':'none';
    get('pv-awards').innerHTML=linesToListItems(awards);

    const pvCustom=get('pv-customsections'); if(pvCustom){
      pvCustom.innerHTML='';
      document.querySelectorAll('.custom-section-edit').forEach(sec=>{
        const title=sec.querySelector('.custom-title')?.value.trim()||'';
        const txt=sec.querySelector('.custom-text')?.value.trim()||'';
        if(!title&&!txt)return;
        const block=document.createElement('div'); block.className='py-3 border-b border-slate-100';
        block.innerHTML='<h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">'+(title||'Additional Section')+'</h3><ul class="text-[13px] text-slate-600 space-y-1 list-disc list-inside">'+linesToListItems(txt)+'</ul>';
        pvCustom.appendChild(block);
      });
    }
  }

  function wireTagInput(inputId, chipClass){
    const input=document.getElementById(inputId); if(!input) return;
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter' && input.value.trim()){
        e.preventDefault();
        const max = inputId === 'softTagInput' ? Infinity : 15;
        const existing = [...input.parentElement.querySelectorAll('.tag-chip')].map(c => (c.childNodes[0]?.textContent || '').trim().toLowerCase());
        if(existing.length >= max){ input.value=''; return toast('Maximum of ' + max + ' tags reached.','warn'); }
        if(existing.includes(input.value.trim().toLowerCase())){ input.value=''; return toast('That skill is already added.','info'); }
        const chip=document.createElement('span'); chip.className='tag-chip '+(chipClass||'');
        chip.innerHTML = input.value.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;') + ' <button type="button"><i class="fa-solid fa-xmark"></i></button>';
        chip.querySelector('button').addEventListener('click',()=>chip.remove());
        input.parentElement.insertBefore(chip,input); input.value='';
      }
    });
  }

  function initResume(){
    document.querySelectorAll('.resume-subtab-btn').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.resume-subtab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.resume-subtab-panel').forEach(p=>p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.resumetab)?.classList.remove('hidden');
      if(btn.dataset.resumetab==='resume-preview') renderResumePreview();
    }));
    wireTagInput('techTagInput','');
    wireTagInput('softTagInput','soft');
    document.querySelectorAll('select.example-chip, select[data-example-for]').forEach(select => select.addEventListener('change', () => {
      const input = document.getElementById(select.dataset.exampleFor), value = select.value;
      if(!input || !value) return;
      input.value = value;
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
      select.value = '';
    }));
    document.getElementById('addCertBtn')?.addEventListener('click',()=>{
      const rows=document.getElementById('certRows'); if(!rows) return;
      if(rows.children.length>=5) return toast('Maximum of 5 certification entries reached.','warn');
      const row=document.createElement('div'); row.className='grid sm:grid-cols-[1fr_1fr_100px] gap-2';
      row.innerHTML='<input type="text" maxlength="60" placeholder="Certification Name" class="border border-slate-300 rounded-md px-3 py-2 text-[12.5px]"><input type="text" maxlength="60" placeholder="Issuing Organization" class="border border-slate-300 rounded-md px-3 py-2 text-[12.5px]"><select class="border border-slate-300 rounded-md px-2 py-2 text-[12.5px]"><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select>';
      rows.appendChild(row);
    });
    document.getElementById('addCustomSectionBtn')?.addEventListener('click',()=>{
      const wrap=document.getElementById('customSections'); if(!wrap)return;
      const card=document.createElement('div'); card.className='border border-slate-200 rounded-lg p-4 custom-section-edit';
      card.innerHTML='<div class="flex items-center justify-between mb-2.5"><input type="text" placeholder="Section title (e.g., Seminars Attended)" class="custom-title flex-1 border-b border-slate-300 focus:outline-none text-[13px] font-semibold text-slate-700 py-1 mr-3"><span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Self-Declared</span></div><textarea rows="2" placeholder="What would you like to add here? One item per line." class="custom-text w-full border border-slate-300 rounded-md px-3 py-2 text-[13px]"></textarea><button type="button" class="remove-section-btn text-[11px] text-red-500 mt-2"><i class="fa-solid fa-trash mr-1"></i>Remove section</button>';
      card.querySelector('.remove-section-btn').addEventListener('click',()=>{card.remove();renderResumePreview();});
      wrap.appendChild(card);
    });
    document.getElementById('includeThesisToggle')?.addEventListener('change',function(){document.getElementById('thesisFields')?.classList.toggle('hidden',!this.checked);});
    document.getElementById('includeCertsToggle')?.addEventListener('change',function(){document.getElementById('certRows')?.classList.toggle('hidden',!this.checked); document.getElementById('addCertBtn')?.classList.toggle('hidden',!this.checked);});
    // Self-declared profile is saved per student (ic_resume); Job Matching reads the skills from here
    const me = getJSON('ic_session', {}), key = (me.email || me.name || '').toLowerCase(), $r = id => document.getElementById(id);
    const escR = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const FIELDS = ['ed-name', 'ed-phone', 'ed-email', 'ed-objective', 'ed-workexp', 'ed-education', 'ed-thesisTitle', 'ed-thesisRole', 'ed-volunteer', 'ed-awards'];
    const chipsOf = box => [...document.querySelectorAll('#' + box + ' .tag-chip')].map(c => (c.childNodes[0]?.textContent || '').trim()).filter(Boolean);
    const langs = () => [...document.querySelectorAll('#resume-edit .gap-x-5 input')];
    const savePart = patch => { const all = getJSON('ic_resume', {}); all[key] = Object.assign(all[key] || {}, patch); localStorage.setItem('ic_resume', JSON.stringify(all)); };
    const collect = () => ({
      fields: Object.fromEntries(FIELDS.map(id => [id, $r(id)?.value || ''])),
      soft: chipsOf('softTagBox'), hard: chipsOf('techTagBox'),
      thesisOn: !!$r('includeThesisToggle')?.checked, certsOn: !!$r('includeCertsToggle')?.checked,
      certs: [...document.querySelectorAll('#certRows > div')].map(row => [...row.querySelectorAll('input, select')].map(x => x.value)).filter(c => c[0]),
      langs: langs().map(x => x.type === 'checkbox' ? x.checked : x.value),
      custom: [...document.querySelectorAll('.custom-section-edit')].map(c => ({title: c.querySelector('.custom-title').value, text: c.querySelector('.custom-text').value})).filter(c => c.title || c.text),
      savedAt: new Date().toISOString()
    });
    function setChips(box, inputId, list, cls){
      document.querySelectorAll('#' + box + ' .tag-chip').forEach(c => c.remove());
      const input = $r(inputId); if(!input) return;
      list.forEach(t => { const chip = document.createElement('span'); chip.className = 'tag-chip ' + cls; chip.innerHTML = escR(t) + ' <button type="button"><i class="fa-solid fa-xmark"></i></button>'; chip.querySelector('button').addEventListener('click', () => chip.remove()); input.parentElement.insertBefore(chip, input); });
    }
    function applyResume(d){
      Object.entries(d.fields || {}).forEach(([id, v]) => { if($r(id)) $r(id).value = v; });
      setChips('softTagBox', 'softTagInput', d.soft || [], 'soft'); setChips('techTagBox', 'techTagInput', d.hard || [], '');
      [['includeThesisToggle', d.thesisOn], ['includeCertsToggle', d.certsOn]].forEach(([id, on]) => { const t = $r(id); if(t){ t.checked = on !== false; t.dispatchEvent(new Event('change')); } });
      const rows = $r('certRows'); if(rows){ rows.innerHTML = ''; (d.certs || []).forEach(c => { $r('addCertBtn').click(); [...rows.lastElementChild.querySelectorAll('input, select')].forEach((x, n) => { x.value = c[n] || x.value; }); }); }
      langs().forEach((x, n) => { const v = (d.langs || [])[n]; if(v === undefined) return; if(x.type === 'checkbox') x.checked = v; else x.value = v; });
      document.querySelectorAll('.custom-section-edit').forEach(c => c.remove());
      (d.custom || []).forEach(c => { $r('addCustomSectionBtn').click(); const card = [...document.querySelectorAll('.custom-section-edit')].pop(); card.querySelector('.custom-title').value = c.title; card.querySelector('.custom-text').value = c.text; });
    }
    const saved = getJSON('ic_resume', {})[key] || {};
    if(saved.savedAt) applyResume(saved);
    else {
      if($r('ed-name') && me.name) $r('ed-name').value = me.name;
      if($r('ed-email') && me.email) $r('ed-email').value = me.email;
      if(getJSON('ic_users', []).some(u => u.role === 'student' && u.email === me.email)){
        ['ed-phone', 'ed-objective', 'ed-workexp', 'ed-volunteer', 'ed-awards'].forEach(id => { if($r(id)) $r(id).value = ''; });
        if($r('ed-education')) $r('ed-education').value = [me.program, me.school].filter(Boolean).join(', ');
        setChips('softTagBox', 'softTagInput', [], 'soft');
        setChips('techTagBox', 'techTagInput', [], '');
        [...document.querySelectorAll('#certRows input')].forEach(input => { input.value = ''; });
      }
    }
    const pdfInput = document.createElement('input'); pdfInput.type = 'file'; pdfInput.accept = 'application/pdf,.pdf'; pdfInput.hidden = true; pdfInput.id = 'resumePdfInput'; document.body.appendChild(pdfInput);
    const showPdf = name => { const row = $r('uploadedPdfRow'); if(!row) return; row.classList.toggle('hidden', !name); row.classList.toggle('flex', !!name); if(name) row.querySelector('span').textContent = name; };
    showPdf(saved.pdf || '');
    const photoInput = document.createElement('input'); photoInput.type = 'file'; photoInput.accept = 'image/png,image/jpeg,image/webp'; photoInput.hidden = true; document.body.appendChild(photoInput);
    const showPhoto = data => {
      if(!data) return;
      [document.querySelector('#resume-preview .w-16.h-16'), document.querySelector('#resume-edit .w-16.h-16')].forEach(box => {
        if(!box) return;
        box.innerHTML = '<img alt="Profile photo" class="w-full h-full object-cover rounded-full" src="' + data + '">';
      });
    };
    showPhoto(me.avatar || '');
    $r('uploadResumePhotoBtn')?.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0]; photoInput.value = '';
      if(!file) return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1024 * 1024) return toast('Choose a PNG, JPG or WebP photo under 1 MB.', 'warn');
      const reader = new FileReader();
      reader.onload = () => {
        const avatar = String(reader.result);
        const users = getJSON('ic_users', []), index = users.findIndex(u => u.role === 'student' && u.email === me.email);
        if(index >= 0){ users[index].avatar = avatar; setJSON('ic_users', users); }
        setJSON('ic_session', Object.assign({}, session(), {avatar}));
        document.querySelectorAll('[data-user="avatar"]').forEach(box => { box.innerHTML = '<img alt="" class="w-full h-full object-cover" src="' + avatar + '">'; });
        showPhoto(avatar);
        toast('Profile photo saved.', 'success');
      };
      reader.readAsDataURL(file);
    });
    $r('uploadResumePdfBtn')?.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', () => {
      const file = pdfInput.files[0]; pdfInput.value = '';
      if(!file) return;
      if(file.type !== 'application/pdf' || file.size > 1500000) return toast('Choose a PDF under 1.5 MB.', 'warn');
      const reader = new FileReader();
      reader.onload = () => { savePart({pdf:file.name, pdfData:String(reader.result)}); showPdf(file.name); toast('Resume PDF attached.', 'success'); };
      reader.readAsDataURL(file);
    });
    $r('uploadedPdfRow')?.querySelector('span')?.addEventListener('click', () => {
      const data = getJSON('ic_resume', {})[key]?.pdfData;
      if(!data) return toast('This older attachment has no saved file. Upload it again to view it.', 'warn');
      const a = document.createElement('a'); a.href = data; a.download = getJSON('ic_resume', {})[key].pdf; a.click();
    });
    $r('uploadedPdfRow')?.querySelector('button')?.addEventListener('click', () => { savePart({pdf: '', pdfData: ''}); showPdf(''); toast('Resume PDF removed.', 'info'); });
    $r('saveSkillsBtn')?.addEventListener('click', () => {
      const d = collect();
      if(!d.hard.length) return toast('Add at least 1 hard skill.', 'warn');
      savePart(d); renderResumePreview(); $r('saveSkillsMicrocopy')?.classList.remove('hidden'); toast('Saved. Your resume preview has been updated.', 'success');
    });
    $r('exportResumePdfBtn')?.addEventListener('click', () => {
      const data = collect(), f = data.fields;
      const verified = allTaskIds().flatMap(id => taskSubmissions(id).filter(s => s.name === me.name && s.status === 'Verified' && s.bullet).map(s => s.bullet));
      exportStudentPdf('Resume_' + fileSlug(me.name || 'Student') + '.pdf', f['ed-name'] || me.name || 'Resume', [
        ['Contact', [f['ed-phone'], f['ed-email']].filter(Boolean).join(' | ')],
        ['Objective', f['ed-objective']], ['Work Experience', f['ed-workexp']], ['Education', f['ed-education']],
        ['Soft Skills', data.soft.join(', ')], ['Technical Skills', data.hard.join(', ')],
        ['Projects', data.thesisOn ? [f['ed-thesisTitle'], f['ed-thesisRole']].filter(Boolean).join(' - ') : ''],
        ['Certifications', data.certsOn ? data.certs.map(c => c.filter(Boolean).join(' - ')).join('\n') : ''],
        ['Volunteer Work', f['ed-volunteer']], ['Awards', f['ed-awards']],
        ...data.custom.map(c => [c.title || 'Additional Section', c.text]),
        ['Verified Internship Experience', verified.join('\n')]
      ]);
    });
    renderResumePreview();
  }
  initResume();
}

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'resume' && window.ICCore?.resume?.init) window.ICCore.resume.init();
  }, { once: true });
})();
