function initStudentJobs({currentUserRecord, isAlumni, session, show, hide, toast, getJSON}){
  // ---------------- Jobs ----------------
  let jobSort = 'match';
  let applicationSubmitting = false;
  let aiMatchScores = new Map();
  // 'loading' until the AI service answers, then 'ready' or 'unavailable'. No other formula fills in for it.
  let aiState = 'loading';
  const aiClient = () => window.ICCore.aiMatching;
  let studentLocation = null;
  let jobDistances = new Map();
  // Radius pre-filter in km (0 = off). Distance only filters and breaks ties; it is never part of the score.
  let radiusKm = 0;
  // Occupation suggestions for the below-threshold fallback, cached per skill list and threshold.
  let fallbackCareers = {key: '', status: 'idle', items: []};

  function cleanJobLocation(location){
    return String(location || '').replace(/\s*[·•]\s*[\d.]+\s*km\s+(?:away|from campus)\s*/i, '').trim();
  }
  function jobCoordinates(job){
    const saved = job.coordinates;
    if(saved){
      const lat = Number(saved.lat), lng = Number(saved.lng);
      if(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return {lat, lng};
    }
    const posted = typeof parseCoords === 'function' ? parseCoords(job.location) : null;
    if(posted && Math.abs(posted.lat) <= 90 && Math.abs(posted.lng) <= 180) return posted;
    const storedSite = getJSON('ic_sites', {})[job.company];
    const site = storedSite || (typeof COMPANY_SITES !== 'undefined' ? COMPANY_SITES[job.company] : null);
    const lat = Number(site?.lat), lng = Number(site?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? {lat, lng} : null;
  }
  function distanceKm(from, to){
    const rad = degrees => degrees * Math.PI / 180;
    const dLat = rad(to.lat - from.lat), dLng = rad(to.lng - from.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function getStudentLocation(){
    return new Promise((resolve, reject) => {
      if(studentLocation) return resolve(studentLocation);
      if(!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
      navigator.geolocation.getCurrentPosition(position => {
        studentLocation = {lat: position.coords.latitude, lng: position.coords.longitude};
        resolve(studentLocation);
      }, error => reject(error), {enableHighAccuracy: false, maximumAge: 60000, timeout: 10000});
    });
  }
  function formatJobLocation(jobId, job){
    const place = cleanJobLocation(job.location);
    const distance = jobDistances.get(jobId);
    if(Number.isFinite(distance)) return place + ' · ' + (distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km') + ' away';
    if(jobSort === 'distance' && !/\bRemote\b/i.test(job.type)) return place + ' · distance unavailable';
    return place;
  }
  async function sortByDistance(){
    const physicalJobs = Object.entries(jobDetails).filter(([, job]) => !/\bRemote\b/i.test(job.type));
    if(!physicalJobs.some(([, job]) => jobCoordinates(job))){
      toast('Company locations are not set yet. Ask your coordinator to add their office locations.', 'info');
      return false;
    }
    try{
      const current = await getStudentLocation();
      jobDistances = new Map(physicalJobs.map(([id, job]) => {
        const site = jobCoordinates(job);
        return [id, site ? distanceKm(current, site) : null];
      }));
      return true;
    }catch(error){
      const message = error.code === 1 ? 'Allow location access to sort internships by distance.' : 'Could not get your location. Try again or check your browser location settings.';
      toast(message, 'warn');
      return false;
    }
  }

  const isRemoteType = job => /\bRemote\b/i.test((job && job.type) || '');
  // Postings the student could apply to: right type for their stage, inside the radius when one is set.
  // The course/arrangement dropdowns are display filters and do not decide whether the fallback applies.
  function eligibleJobIds(){
    const alumni = isAlumni(currentUserRecord());
    return Object.entries(jobDetails)
      .filter(([id, job]) => isInternshipJob(job) !== alumni && aiClient().withinRadius(jobDistances.get(id), radiusKm, isRemoteType(job)))
      .map(([id]) => id);
  }
  function resumeSkillsForDisplay(){
    const me = session() || {}, resume = getJSON('ic_resume', {})[jmKey(me)] || {};
    const own = [...(resume.hard || []), ...(resume.soft || [])].map(skill => String(skill).trim()).filter(Boolean);
    return [...new Set(own.length ? own : jmSkills(me))];
  }
  // Below-threshold fallback: when the service answered and no eligible posting reaches tau, show the student's key
  // skills, the closest O*NET occupations, and outbound links. Skills only are sent; nothing is scraped or fetched
  // from the external platforms.
  function updateFallback(visibleCount){
    const box = document.getElementById('fallbackAlert'); if(!box) return;
    const ai = aiClient(), skills = resumeSkillsForDisplay();
    const threshold = Number.isFinite(aiMatchScores.threshold) ? aiMatchScores.threshold : ai.DEFAULT_THRESHOLD;
    const wrap = body => '<div class="flex items-start gap-2.5"><i class="fa-solid fa-circle-info text-slate-400 mt-0.5"></i><div class="min-w-0">' + body + '</div></div>';
    const needed = ai.fallbackNeeded({state: aiState, hasSkills: skills.length > 0, scores: aiMatchScores, ids: eligibleJobIds(), threshold});
    if(!needed){
      if(visibleCount === 0){
        box.innerHTML = wrap('<div class="text-[12.5px] font-semibold text-slate-700">No postings match the selected filters</div><p class="text-[12px] text-slate-500 mt-1">Change or clear a filter to see more postings.</p>');
        box.classList.remove('hidden');
      }else box.classList.add('hidden');
      return;
    }
    const key = skills.join('|') + '|' + threshold;
    if(fallbackCareers.key !== key){
      fallbackCareers = {key, status: 'loading', items: []};
      ai.fetchCareers(skills, 3)
        .then(items => ({key, status: 'ready', items}), () => ({key, status: 'failed', items: []}))
        .then(next => { if(fallbackCareers.key === key){ fallbackCareers = next; filterJobs(); } });
    }
    const chips = skills.slice(0, 8).map(skill => '<span class="tag-chip">' + esc(skill) + '</span>').join(' ');
    const careers = fallbackCareers.status === 'loading'
      ? '<p class="text-[12px] text-slate-400 mt-1">Finding occupations that align with your skills…</p>'
      : fallbackCareers.items.length
        ? '<ul class="mt-1 space-y-1">' + fallbackCareers.items.map(item => '<li class="text-[12.5px] text-slate-700">' + esc(item.title) + ' <span class="text-slate-400">· ' + esc(String(item.alignment_percent)) + '% alignment</span></li>').join('') + '</ul>'
        : '<p class="text-[12px] text-slate-400 mt-1">Occupation suggestions are not available right now.</p>';
    const links = ai.EXTERNAL_PLATFORMS.map(platform => '<a href="' + esc(platform.url) + '" target="_blank" rel="noopener noreferrer" class="font-medium text-sky-600 hover:underline">' + esc(platform.name) + '</a>').join(' · ');
    box.innerHTML = wrap('<div class="text-[12.5px] font-semibold text-slate-700">No posting reaches the ' + Math.round(threshold * 100) + '% similarity threshold yet</div>'
      + '<p class="text-[11px] font-semibold text-slate-500 mt-2 mb-1">Your key skills</p><div class="flex flex-wrap gap-1">' + chips + '</div>'
      + '<p class="text-[11px] font-semibold text-slate-500 mt-3">Occupations that align with your skills (O*NET)</p>' + careers
      + '<p class="text-[12px] text-slate-500 mt-3">You can also look for openings on ' + links + '.</p>'
      + '<p class="text-[10.5px] text-slate-400 mt-2">General career directions from U.S. O*NET data, not current vacancies or hiring probabilities.</p>');
    box.classList.remove('hidden');
  }

  function filterJobs(){
    const list=document.getElementById('jobList'); if(!list)return;
    const user=currentUserRecord(); const alumni=isAlumni(user);
    const course=document.getElementById('courseFilter')?.value||'';
    const type=document.getElementById('typeFilter')?.value||'';
    const arrangement=document.getElementById('arrangementFilter')?.value||'';
    let visible=0;
    list.querySelectorAll('.job-card').forEach(card=>{
      const courseOk=!course||card.dataset.course===course;
      const typeOk=alumni ? (card.dataset.type!=='Internship' && (!type || card.dataset.type===type)) : card.dataset.type==='Internship';
      const arrangeOk=!arrangement||card.dataset.arrangement===arrangement;
      const radiusOk=aiClient().withinRadius(parseFloat(card.dataset.km), radiusKm, card.dataset.arrangement==='Remote');
      const ok=courseOk&&typeOk&&arrangeOk&&radiusOk;
      card.classList.toggle('hidden',!ok); if(ok)visible++;
    });
    updateFallback(visible);
    document.getElementById('typeFilter')?.classList.toggle('hidden',!alumni);
  }

  function openJobModal(id){
    const j=jobDetails[id]; if(!j)return;
    const match=jobMatch(j,session()||{}), aiScore=aiMatchScores.get(id);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('jobModalTitle',j.title);set('jobModalCompany',j.company);set('jobModalType',j.type);set('jobModalSalary',j.salary);set('jobModalDescription',j.description);set('jobModalDeadline',j.deadline);
    const score=document.getElementById('jobModalScore');if(score){score.title=aiClient().SCORE_NOTE;score.innerHTML='<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>'+esc(Number.isFinite(aiScore)?aiClient().percentText(aiScore)+' match':aiClient().badgeText(aiScore,aiState));}
    const loc=document.getElementById('jobModalLocation');if(loc)loc.innerHTML='<i class="fa-solid fa-location-dot mr-1"></i>'+esc(formatJobLocation(id,j));
    const req=document.getElementById('jobModalRequirements');if(req)req.innerHTML=j.requirements.map(x=>'<li>'+esc(x)+'</li>').join('');
    const tags=document.getElementById('jobModalSkillTags');if(tags)tags.innerHTML=match.skills.map(([n,m])=>(m ? '<span class="tag-chip matched"><i class="fa-solid fa-check"></i>'+esc(n)+'</span>' : '<span class="tag-chip gap">'+esc(n)+' <span class="chip-note">gap</span></span>')).join('');
    document.getElementById('jobModalApplyBtn')?.setAttribute('data-job',id);
    const ab=document.getElementById('jobModalApplyBtn'); if(ab){ const done=jmApplied(id,session()||{}); ab.textContent=done?'Applied':'Apply Now'; ab.disabled=done; ab.classList.toggle('opacity-60',done); }
    show('jobModal');
  }
  const chipHtml = (skills) => skills.map(([n,m]) => m ? '<span class="tag-chip matched"><i class="fa-solid fa-check"></i>'+esc(n)+'</span>' : '<span class="tag-chip gap">'+esc(n)+' <span class="chip-note">gap</span></span>').join('');
  function renderJobCards(){
    const me = session() || {}, list = document.getElementById('jobList'); if(!list) return;
    const cards = [...list.querySelectorAll('.job-card')];
    cards.forEach(card => {
      const j = jobDetails[card.dataset.job]; if(!j) return;
      const m = jobMatch(j, me), aiScore = aiMatchScores.get(card.dataset.job);
      card.dataset.score = Number.isFinite(aiScore) ? String(aiScore) : '';
      const distance = jobDistances.get(card.dataset.job);
      card.dataset.km = Number.isFinite(distance) ? String(distance) : 'unavailable';
      const location = card.querySelector('[data-job-location]');
      if(location) location.textContent = formatJobLocation(card.dataset.job, j);
      const badge = card.querySelector('.fa-wand-magic-sparkles')?.parentElement; if(badge){ badge.title = aiClient().SCORE_NOTE; badge.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>' + esc(aiClient().badgeText(aiScore, aiState)); }
      const chips = card.querySelector('.tag-chip')?.parentElement; if(chips) chips.innerHTML = chipHtml(m.skills);
      const btn = card.querySelector('.apply-btn'), done = jmApplied(card.dataset.job, me);
      if(btn){ btn.textContent = done ? 'Applied' : 'Apply Now'; btn.disabled = done; btn.classList.toggle('opacity-60', done); btn.classList.toggle('cursor-default', done); }
    });
    cards.sort((x, y) => {
      if(jobSort === 'distance'){
        const dx = Number(x.dataset.km), dy = Number(y.dataset.km);
        return (Number.isFinite(dx) ? dx : Infinity) - (Number.isFinite(dy) ? dy : Infinity);
      }
      // Similarity decides the order. Distance (when the student has shared a location) only breaks ties at the same
      // displayed percentage. Unscored cards tie at the bottom, and the stable sort keeps their posted order.
      const score = card => parseFloat(card.dataset.score), km = card => parseFloat(card.dataset.km);
      return aiClient().rankCompare(score(x), km(x), score(y), km(y));
    }).forEach(c => list.insertBefore(c, document.getElementById('fallbackAlert')));
    const tbody = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === 'Application Status')?.closest('.bg-white')?.querySelector('tbody');
    if(!tbody) return;
    const apps = myJobApps(me).slice().reverse();
    tbody.innerHTML = apps.length ? apps.map(a => { const st = jobAppStatus(a, me);
      const badge = a.databaseApplication || !a.internship ? jobBadge(st) : st === 'Cancelled' ? '<span class="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Cancelled</span>' : placementBadge(st);
      return '<tr><td class="px-5 py-3 text-slate-700">' + esc(a.title) + '</td><td class="px-5 py-3 text-slate-600">' + esc(a.company) + '</td><td class="px-5 py-3 text-slate-500">' + formatDate(a.date) + '</td><td class="px-5 py-3">' + badge + '</td></tr>'; }).join('')
      : '<tr><td colspan="4" class="px-5 py-6 text-center text-[12.5px] text-slate-400">No applications yet. Apply to a job above.</td></tr>';
  }
  async function loadAiMatchScores(){
    const me = session() || {};
    const studentSkills = jmSkills(me).map(skill => String(skill).trim()).filter(Boolean);
    const postings = aiClient().buildPostings(jobDetails);
    if(!studentSkills.length){ aiState = 'unavailable'; renderJobCards(); filterJobs(); return; }
    // No scoreable postings at all counts as "nothing matches", so the fallback still helps the student.
    if(!postings.length){ aiMatchScores = new Map(); aiState = 'ready'; renderJobCards(); filterJobs(); return; }
    try{
      aiMatchScores = await aiClient().rankJobs(studentSkills, postings);
      aiState = 'ready';
    }catch(error){
      // No substitute formula: cards say the score is unavailable and keep their posted order.
      aiMatchScores = new Map();
      aiState = 'unavailable';
      console.debug('Local AI matching is unavailable; scores are not shown.');
    }
    renderJobCards();
    filterJobs(); // re-evaluates the radius filter and the below-threshold fallback with the new scores
  }
  async function applyJob(id){
    const j = jobDetails[id], me = session() || {}; if(!j) return false;
    if(applicationSubmitting) return false;
    if(me.databaseAccount){
      if(!isSharedPosting(id)) return toast('This posting is not available for online applications.', 'warn');
      if(!await askConfirm('Apply to ' + j.company + ' as ' + j.title + '? Your saved resume will be submitted.')) return false;
      applicationSubmitting = true;
      try{
        await window.ICStudentApi.apply(id);
        const result = await window.ICStudentApi.applications();
        cacheDatabaseApplications(result.applications);
        renderJobCards();
        toast('Application submitted with your saved resume.', 'success');
        return true;
      }catch(error){ toast(error.message || 'Could not submit your application. Please refresh and try again.', 'warn'); return false; }
      finally{ applicationSubmitting = false; }
    }
    if(jmApplied(id, me)){ toast('You already applied to this job.', 'info'); return false; }
    const internship = isInternshipJob(j);
    if(internship){
      const p = placementList().find(x => x.name === me.name || (me.email && x.email === me.email));
      if(p && !['Not placed', 'Withdrawn'].includes(p.status)){ toast('You already have an active OJT application' + (p.company ? ' with ' + p.company : '') + '. Only one at a time.', 'warn'); return false; }
      if(!partnerCompanies().includes(j.company) && !isSharedPosting(id)){ toast(j.company + ' is not a partner company yet. Ask your coordinator.', 'warn'); return false; }
      if(!await askConfirm('Apply to ' + j.company + ' as ' + j.title + '?\n\nThis records your OJT application and your coordinator will review it.')) return false;
      savePlacement(me.name, {status: 'Applied', company: j.company, position: j.title, source: 'student', email: me.email, history: ((p || {}).history || []).concat({status: 'Applied', date: todayISO(), note: j.company + ' · ' + j.title + ' · by student via Job Matching'})});
    }
    const all = getJSON(JOB_APPS_KEY, {}), k = jmKey(me);
    all[k] = (all[k] || []).filter(a => a.job !== id).concat({job: id, title: j.title, company: j.company, date: todayISO(), internship, name: me.name, email: me.email, program: me.program});
    localStorage.setItem(JOB_APPS_KEY, JSON.stringify(all));
    toast(internship ? 'Application to ' + j.company + ' recorded. Your coordinator will review it.' : 'Application submitted to ' + j.company + '.', 'success');
    renderJobCards(); return true;
  }
  async function initJobs(){
    const list = document.getElementById('jobList');
    list?.querySelectorAll('.job-card').forEach(card => card.remove());
    renderJobCards();
    list?.insertAdjacentHTML('afterbegin', '<p id="postingsLoading" class="text-[12.5px] text-slate-400 py-4">Loading available postings…</p>');
    if(window.ICPostingApi){
      try { setSharedPostings(await window.ICPostingApi.list((session() || {}).classCode || SEED_CODE)); }
      catch(error){ toast('Shared postings are unavailable. Showing postings saved in this browser.', 'info'); }
    }
    document.getElementById('postingsLoading')?.remove();
    renderJobList();
    document.getElementById('courseFilter')?.addEventListener('change',filterJobs);
    document.getElementById('typeFilter')?.addEventListener('change',filterJobs);
    document.getElementById('arrangementFilter')?.addEventListener('change',filterJobs);
    // Radius pre-filter: asks for the student's location only when they pick a radius, and turns itself off if it is refused.
    document.getElementById('radiusFilter')?.addEventListener('change',async e=>{
      const km=Number(e.target.value)||0;
      if(km&&!await sortByDistance()){ e.target.value=''; radiusKm=0; }
      else radiusKm=km;
      renderJobCards(); filterJobs();
    });
    document.querySelectorAll('.job-card').forEach(card=>card.addEventListener('click',e=>{if(e.target.closest('.apply-btn'))return;openJobModal(card.dataset.job);}));
    document.querySelectorAll('.apply-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();applyJob(btn.closest('.job-card')?.dataset.job);}));
    document.querySelectorAll('.sort-btn').forEach(btn=>btn.addEventListener('click',async()=>{
      if(btn.dataset.sort === 'distance' && !await sortByDistance()) return;
      jobSort=btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b=>{const on=b===btn;b.classList.toggle('active',on);['bg-slate-900','text-white'].forEach(c=>b.classList.toggle(c,on));['bg-white','border','border-slate-200','text-slate-600'].forEach(c=>b.classList.toggle(c,!on));});
      renderJobCards();
    }));
    document.getElementById('closeJobModalBtn')?.addEventListener('click',()=>hide('jobModal'));
    document.getElementById('jobModalApplyBtn')?.addEventListener('click',()=>{applyJob(document.getElementById('jobModalApplyBtn').dataset.job).then(ok=>{if(ok) hide('jobModal');});});
    renderJobCards();
    loadAiMatchScores();
    filterJobs();
  }
  initJobs();
}

function jobCardHtml(id, j){
    const [kind, arrangement] = j.type.split(' · ');
    return '<div class="job-card bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-sky-300 transition cursor-pointer" data-arrangement="' + esc(arrangement || '') + '" data-course="' + esc(j.course) + '" data-job="' + esc(id) + '" data-type="' + esc(kind) + '">'
      + '<div class="flex items-start justify-between gap-3"><div><div class="font-semibold text-slate-900">' + esc(j.title) + '</div>'
      + '<div class="text-[12px] text-slate-500 mt-0.5">' + esc(j.company) + ' · <i class="fa-solid fa-location-dot text-[10px]"></i> <span data-job-location>' + esc(cleanSeedJobLocation(j.location)) + '</span> · <span class="text-slate-400">' + esc(j.course) + ' · ' + esc(j.type) + '</span></div></div>'
      + '<span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 flex-shrink-0"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>…</span></div>'
      + '<div class="flex flex-wrap gap-1.5 mt-3"><span class="tag-chip"></span></div>'
      + '<button class="apply-btn mt-3 text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3.5 py-2 rounded-md transition">Apply Now</button></div>';
}
function cleanSeedJobLocation(location){
    return String(location || '').replace(/\s*[·•]\s*[\d.]+\s*km\s+(?:away|from campus)\s*/i, '').trim();
}
function renderJobList(){
    const list = document.getElementById('jobList'); if(!list) return;
    list.querySelectorAll('.job-card').forEach(c => c.remove());
    list.insertAdjacentHTML('afterbegin', Object.entries(jobDetails).map(([id, j]) => jobCardHtml(id, j)).join(''));
}

(function () {
  'use strict';
  document.addEventListener('ic:student-ready', () => {
    if (document.body.dataset.page === 'jobs' && window.ICCore?.student?.initJobs) window.ICCore.student.initJobs();
  }, { once: true });
})();
