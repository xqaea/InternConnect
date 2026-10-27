/* ============ Partner Company portal (optional: the coordinator can still do all of this) ============ */
// Students who applied to a posting, ranked by compatibility (same score the student sees in Job Matching)
function applicantsOf(job){
    const users = getUsers(), out = [];
    Object.entries(getJSON(JOB_APPS_KEY, {})).forEach(([key, apps]) => apps.filter(a => a.job === job.id).forEach(a => {
        const u = users.find(x => (x.email || '').toLowerCase() === key || (x.name || '').toLowerCase() === key) || {};
        const who = {email: a.email || u.email || key, name: a.name || u.name || key, program: a.program || u.program || 'BS Computer Science'};
        const status = jobAppStatus(a, who);
        if(['Cancelled', 'Withdrawn', 'Not placed'].includes(status)) return;
        out.push({key, who, app: a, status, match: jobMatch(job, Object.assign({}, who, {email: key}))});
    }));
    return out.sort((x, y) => y.match.score - x.match.score);
}
// Resume shown to the partner: self-declared (Resume Builder); jobs also get the system-generated Verified entries
function resumeHtml(key, name, withVerified){
    const r = getJSON('ic_resume', {})[key] || {}, f = r.fields || {};
    const sec = (t, body) => body ? '<div class="py-2.5"><div class="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 mb-1">' + t + '</div>' + body + '</div>' : '';
    const text = (v) => v ? '<p class="text-[12.5px] text-slate-700 whitespace-pre-line">' + esc(v) + '</p>' : '';
    const chips = (l) => (l || []).length ? '<div class="flex flex-wrap gap-1.5">' + l.map(x => '<span class="tag-chip">' + esc(x) + '</span>').join('') + '</div>' : '';
    let html = '<div class="text-[11px] font-semibold text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded-full mb-1">Self-declared</div>'
      + '<div class="font-semibold text-slate-900">' + esc(f['ed-name'] || name) + '</div><div class="text-[12px] text-slate-500">' + esc([f['ed-email'], f['ed-phone']].filter(Boolean).join(' · ')) + '</div>'
      + (r.savedAt ? '' : '<p class="text-[12px] text-amber-600 mt-2">This student has not saved a resume yet.</p>')
      + '<div class="divide-y divide-slate-100">' + sec('Objective', text(f['ed-objective'])) + sec('Soft skills', chips(r.soft)) + sec('Technical skills', chips(r.hard))
      + sec('Education', text(f['ed-education'])) + sec('Work experience', text(f['ed-workexp']))
      + sec('Thesis / project', r.thesisOn ? text([f['ed-thesisTitle'], f['ed-thesisRole']].filter(Boolean).join(' · ')) : '')
      + sec('Certifications', r.certsOn ? text((r.certs || []).map(c => c.filter(Boolean).join(' · ')).join('\n')) : '')
      + sec('Volunteer work', text(f['ed-volunteer'])) + sec('Awards', text(f['ed-awards']))
      + (r.pdfData ? sec('Uploaded resume', '<button type="button" data-resume-download="' + esc(key) + '" class="text-[12.5px] font-medium text-sky-600 hover:underline">Download ' + esc(r.pdf) + '</button>') : '')
      + (r.custom || []).map(c => sec(esc(c.title || 'Other'), text(c.text))).join('') + '</div>';
    if(withVerified){
        const ver = allTaskIds().flatMap(id => taskSubmissions(id).filter(x => x.name === name && x.status === 'Verified' && x.bullet).map(x => [taskInfo(id).title, x.bullet]));
        html += '<div class="mt-3 border-t border-slate-200 pt-3"><div class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded-full mb-2"><i class="fa-solid fa-circle-check mr-1"></i>System-generated · verified by the OJT coordinator</div>'
          + (ver.length ? ver.map(([t, b]) => '<div class="flex justify-between gap-3 text-[12.5px] text-slate-700 py-1"><p>' + esc(b) + '</p><span class="text-[10.5px] text-slate-400 whitespace-nowrap">' + esc(t) + '</span></div>').join('') : '<p class="text-[12px] text-slate-400">No verified OJT entries.</p>') + '</div>';
    }
    return html;
}


if(document.body.dataset.ppage) (function(){
    const me = getJSON('ic_session', {}) || {};
    if(me.role !== 'partnercompany') return;
    const company = me.company || '', page = document.body.dataset.ppage.replace(/^p/, ''), params = new URLSearchParams(window.location.search);

    // Partner pages share the dashboard shell, but do not load coordinator/common.js.
    // Bind the shared sidebar controls here so partner navigation remains functional.
    document.querySelectorAll('#sidebar .nav-link[data-tab]').forEach(button => {
        button.addEventListener('click', async () => {
            if(button.dataset.tab === 'logout'){
                if(!await askConfirm('Log out of InternConnect?')) return;
                localStorage.removeItem('ic_session');
                goTo('login', 'You have been logged out.', 'info');
                return;
            }
            goTo(button.dataset.tab);
        });
    });
    mobileToggle?.addEventListener('click', () => {
        sidebar?.classList.remove('-translate-x-full');
        overlay?.classList.remove('hidden');
        mobileToggle.classList.add('hidden');
    });
    const closePartnerSidebar = () => {
        sidebar?.classList.add('-translate-x-full');
        overlay?.classList.add('hidden');
        mobileToggle?.classList.remove('hidden');
    };
    document.getElementById('mobileCloseBtn')?.addEventListener('click', closePartnerSidebar);
    overlay?.addEventListener('click', closePartnerSidebar);
    const collapseButton = document.getElementById('collapseBtn');
    if(localStorage.getItem('sidebarCollapsed') === 'true'){
        sidebar?.classList.add('collapsed');
        mainFooter?.classList.add('collapsed');
    }
    collapseButton?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
        mainFooter?.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', String(sidebar?.classList.contains('collapsed')));
    });
    const partnerNotifButton = document.getElementById('notifBtn');
    const partnerNotifDropdown = document.getElementById('notifDropdown');
    partnerNotifButton?.addEventListener('click', event => {
        event.stopPropagation();
        partnerNotifDropdown?.classList.toggle('hidden');
        document.getElementById('pNotifDot')?.classList.add('hidden');
    });
    document.addEventListener('click', event => {
        if(partnerNotifDropdown && !partnerNotifDropdown.contains(event.target)) partnerNotifDropdown.classList.add('hidden');
    });

    const placed = () => placementList().filter(p => p.company === company);
    const myPosts = () => Object.values(allPostings()).filter(j => j.company === company);
    const card = 'bg-white rounded-xl border border-slate-200 shadow-sm';
    const btn = 'text-[11.5px] font-semibold px-2.5 py-1 rounded-md transition ';
    let modal = document.getElementById('pModal');
    if(!modal){
        document.body.insertAdjacentHTML('beforeend', '<div id="pModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">'
          + '<div class="flex items-center justify-between mb-3"><h3 id="pModalTitle" class="font-bold text-slate-900"></h3><button data-pclose class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div><div id="pModalBody"></div></div></div>');
        modal = document.getElementById('pModal');
        modal.addEventListener('click', (e) => { if(e.target.closest('[data-pclose]')) closeModal(modal); });
    }
    const showModal = (title, body) => { document.getElementById('pModalTitle').textContent = title; document.getElementById('pModalBody').innerHTML = body; openModal(modal); };
    document.addEventListener('click', (e) => {
        const r = e.target.closest('[data-resume]'); if(!r) return;
        showModal('Resume · ' + r.dataset.name, resumeHtml(r.dataset.resume, r.dataset.name, r.dataset.verified === '1'));
    });
    document.addEventListener('click', (e) => {
        const button = e.target.closest('[data-resume-download]'); if(!button) return;
        const r = getJSON('ic_resume', {})[button.dataset.resumeDownload];
        if(!r?.pdfData) return;
        const a = document.createElement('a'); a.href = r.pdfData; a.download = r.pdf || 'Resume.pdf'; a.click();
    });

    function needsAction(){
        const items = [], vault = ensureVault(company), vlink = (n) => pages.pvault + '?intern=' + encodeURIComponent(n);
        placed().forEach(p => {
            if(p.status === 'Endorsed' && !hasDoc(company, p.name, 'Acceptance letter')) items.push({icon: 'fa-file-signature', text: 'Upload the signed acceptance letter of <strong>' + esc(p.name) + '</strong>', href: vlink(p.name)});
            if(p.status === 'Hours complete' && !hasDoc(company, p.name, 'Supervisor evaluation')) items.push({icon: 'fa-clipboard-check', text: '<strong>' + esc(p.name) + '</strong> finished the required hours. Upload the signed supervisor evaluation', href: vlink(p.name)});
        });
        vault.files.filter(f => f.pending && f.owner === 'hr' && (f.pendingBy || 'coordinator') !== 'hr').forEach(f => items.push({icon: 'fa-lock-open', text: 'The coordinator asks to ' + f.pending + ' <strong>' + esc(f.name) + '</strong>', href: pages.pvault}));
        myPosts().filter(j => j.status !== 'closed').forEach(j => { const n = applicantsOf(j).length; if(n) items.push({icon: 'fa-user-plus', text: n + ' applicant' + (n === 1 ? '' : 's') + ' for <strong>' + esc(j.title) + '</strong>', href: pages.ppostings + '?job=' + encodeURIComponent(j.id)}); });
        return items;
    }
    const itemRow = (x) => '<a href="' + x.href + '" class="px-4 py-3 flex gap-3 hover:bg-slate-50"><div class="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0"><i class="fa-solid ' + x.icon + ' text-[11px]"></i></div><div class="text-[12.5px] text-slate-700 min-w-0">' + x.text + '</div></a>';
    const needs = needsAction();
    const nl = document.getElementById('pNotifList');
    if(nl) nl.innerHTML = needs.length ? needs.map(itemRow).join('') : '<div class="px-4 py-6 text-center text-[12px] text-slate-400">You are all caught up.</div>';
    document.getElementById('pNotifDot')?.classList.toggle('hidden', !needs.length);

    if(page === 'overview'){
        const all = placed(), interns = all.filter(p => ['Accepted', 'Deployed', 'Hours complete', 'Completed'].includes(p.status));
        const applying = all.filter(p => ['Applied', 'Endorsed'].includes(p.status)), open = myPosts().filter(j => j.status !== 'closed');
        const stat = (v, l, icon) => '<div class="' + card + ' p-4"><div class="flex items-center justify-between"><div class="text-2xl font-extrabold text-slate-900">' + v + '</div><i class="fa-solid ' + icon + ' text-sky-500"></i></div><div class="text-[12.5px] text-slate-500 mt-1">' + l + '</div></div>';
        const th = (l) => '<th class="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">' + l + '</th>';
        const sched = (p) => { const s = scheduleOf(p); return s.days.map(d => DAY_NAMES[d]).join(', ') + ' · ' + fmtClock(clockMins(s.timeIn)) + '–' + fmtClock(clockMins(s.timeOut)) + ' · ' + s.mode; };
        const att = (p) => { const r = internAttendance(p), n = (st) => r.filter(x => x.status === st).length; return r.length ? (n('Present') + n('Late')) + ' present · ' + n('Late') + ' late · ' + n('Absent') + ' absent' + (n('Flagged') ? ' · ' + n('Flagged') + ' flagged' : '') : '—'; };
        document.getElementById('pOverview').innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' + stat(all.filter(p => ['Deployed', 'Hours complete'].includes(p.status)).length, 'Interns deployed', 'fa-user-graduate')
            + stat(applying.length, 'Students in process', 'fa-route') + stat(open.length, 'Open postings', 'fa-briefcase') + stat(needs.length, 'Needs your action', 'fa-bell') + '</div>'
          + '<div class="' + card + '"><div class="px-5 py-3.5 border-b border-slate-200 font-semibold text-sm text-slate-900">Needs your action</div><div class="divide-y divide-slate-100">' + (needs.length ? needs.map(itemRow).join('') : '<div class="px-5 py-5 text-[12.5px] text-slate-400">Nothing to do right now.</div>') + '</div></div>'
          + '<div class="' + card + ' overflow-x-auto"><div class="px-5 py-3.5 border-b border-slate-200"><div class="font-semibold text-sm text-slate-900">Your interns</div><div class="text-[11.5px] text-slate-400">View only. Schedules, attendance reviews and completion are handled by the OJT coordinator.</div></div>'
          + '<table class="w-full text-[12.5px]"><thead class="bg-slate-50"><tr>' + th('Intern') + th('Status') + th('Hours') + th('Schedule') + th('Attendance') + th('') + '</tr></thead><tbody class="divide-y divide-slate-100">'
          + (interns.length ? interns.map(p => '<tr><td class="px-4 py-3 font-medium text-slate-900">' + esc(p.name) + '</td><td class="px-4 py-3">' + placementBadge(p.status) + '</td><td class="px-4 py-3 text-slate-600 whitespace-nowrap">' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + '</td>'
              + '<td class="px-4 py-3 text-slate-600">' + (p.status === 'Accepted' ? 'Starts after deployment' : esc(sched(p))) + '</td><td class="px-4 py-3 text-slate-600">' + att(p) + '</td>'
              + '<td class="px-4 py-3 text-right"><a href="' + pages.pvault + '?intern=' + encodeURIComponent(p.name) + '" class="text-[11.5px] font-medium text-sky-600 hover:text-sky-700 whitespace-nowrap"><i class="fa-solid fa-folder-open mr-1"></i>Files</a></td></tr>').join('')
            : '<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">No interns at ' + esc(company) + ' yet.</td></tr>') + '</tbody></table></div>'
          + '<div class="' + card + ' overflow-x-auto"><div class="px-5 py-3.5 border-b border-slate-200"><div class="font-semibold text-sm text-slate-900">Students applying to ' + esc(company) + '</div><div class="text-[11.5px] text-slate-400">Endorsed students need your signed acceptance letter in the vault.</div></div>'
          + '<table class="w-full text-[12.5px]"><thead class="bg-slate-50"><tr>' + th('Student') + th('Position') + th('Status') + th('') + '</tr></thead><tbody class="divide-y divide-slate-100">'
          + (applying.length ? applying.map(p => '<tr><td class="px-4 py-3 font-medium text-slate-900">' + esc(p.name) + '</td><td class="px-4 py-3 text-slate-600">' + esc(p.position || '—') + '</td><td class="px-4 py-3">' + placementBadge(p.status) + '</td>'
              + '<td class="px-4 py-3 text-right whitespace-nowrap"><button data-resume="' + esc((p.email || p.name).toLowerCase()) + '" data-name="' + esc(p.name) + '" class="' + btn + 'text-sky-600 bg-sky-50 hover:bg-sky-100">View resume</button>'
              + (p.status === 'Endorsed' ? '<a href="' + pages.pvault + '?intern=' + encodeURIComponent(p.name) + '" class="ml-2 ' + btn + 'text-white bg-sky-600 hover:bg-sky-700">Upload acceptance</a>' : '') + '</td></tr>').join('')
            : '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400">No applications in process.</td></tr>') + '</tbody></table></div>';
    }

    if(page === 'vault'){
        document.getElementById('closeVaultModalBtn')?.classList.add('hidden');
        openVault(company, params.get('intern'));
    }

    if(page === 'postings'){
        let selected = params.get('job') || '';
        const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
        const render = () => {
            const posts = myPosts().sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
            const sel = posts.find(j => j.id === selected);
            const ranking = (j) => { const list = applicantsOf(j), internship = isInternshipJob(j);
                return '<div class="border-t border-slate-200 mt-4 pt-4"><div class="text-[12.5px] font-semibold text-slate-800 mb-1">Candidate ranking</div><div class="text-[11.5px] text-slate-400 mb-3">Sorted by compatibility: 40% course fit + 60% of this posting\'s skills found in the applicant\'s resume. '
                  + (internship ? 'Internship applicants show their self-declared resume.' : 'Job applicants show their self-declared resume and verified OJT entries.') + '</div>'
                  + (list.length ? '<div class="overflow-x-auto"><table class="w-full text-[12.5px]"><tbody class="divide-y divide-slate-100">' + list.map((a, i) => '<tr><td class="py-2.5 pr-3 text-slate-400 font-semibold">#' + (i + 1) + '</td>'
                      + '<td class="py-2.5 pr-3"><div class="font-medium text-slate-900">' + esc(a.who.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(a.who.program) + ' · applied ' + formatDate(a.app.date) + '</div></td>'
                      + '<td class="py-2.5 pr-3 w-36"><div class="font-bold text-indigo-700">' + a.match.score + '%</div><div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500" style="width:' + a.match.score + '%"></div></div></td>'
                      + '<td class="py-2.5 pr-3"><div class="flex flex-wrap gap-1">' + a.match.skills.map(([n, ok]) => ok ? '<span class="tag-chip matched"><i class="fa-solid fa-check"></i>' + esc(n) + '</span>' : '<span class="tag-chip gap">' + esc(n) + ' <span class="chip-note">gap</span></span>').join('') + (a.match.courseOk ? '' : '<span class="text-[10.5px] text-amber-600">different course</span>') + '</div></td>'
                      + '<td class="py-2.5 pr-3">' + (internship ? placementBadge(a.status) : jobStatusSelect(a.key, j.id, a.status)) + '</td>'
                      + '<td class="py-2.5 text-right"><button data-resume="' + esc(a.key) + '" data-name="' + esc(a.who.name) + '" data-verified="' + (internship ? '0' : '1') + '" class="' + btn + 'text-sky-600 bg-sky-50 hover:bg-sky-100 whitespace-nowrap">View resume</button></td></tr>').join('') + '</tbody></table></div>'
                    : '<div class="text-[12.5px] text-slate-400 border border-dashed border-slate-200 rounded-md py-6 text-center">No applicants yet. Students see this posting in their Job Matching.</div>') + '</div>'; };
            document.getElementById('pPostings').innerHTML = '<div class="flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-xl font-bold text-slate-900">Job Postings</h1><p class="text-sm text-slate-500 mt-0.5">Internships and jobs from ' + esc(company) + '. Students see open postings in Job Matching.</p></div>'
              + '<button data-post="new" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3.5 py-2 rounded-md"><i class="fa-solid fa-plus mr-1.5"></i>New posting</button></div>'
              + (posts.length ? posts.map(j => { const n = applicantsOf(j).length, closed = j.status === 'closed';
                  return '<div class="' + card + ' p-5' + (j.id === selected ? ' ring-2 ring-sky-300' : '') + '"><div class="flex flex-wrap items-start justify-between gap-3"><div><div class="font-semibold text-slate-900">' + esc(j.title) + '</div>'
                    + '<div class="text-[12px] text-slate-500 mt-0.5">' + esc(j.type) + ' · ' + esc(j.course) + ' · ' + esc(j.location) + '</div><div class="text-[11.5px] text-slate-400 mt-0.5">' + esc(j.deadline || '') + '</div></div>'
                    + '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border ' + (closed ? 'text-slate-500 bg-slate-50 border-slate-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200') + '">' + (closed ? 'Closed' : 'Open') + '</span></div>'
                    + '<div class="flex flex-wrap gap-2 mt-3"><button data-post="view" data-id="' + esc(j.id) + '" class="' + btn + 'text-white bg-sky-600 hover:bg-sky-700"><i class="fa-solid fa-ranking-star mr-1"></i>' + (j.id === selected ? 'Hide applicants' : 'View applicants') + ' (' + n + ')</button>'
                    + '<button data-post="edit" data-id="' + esc(j.id) + '" class="' + btn + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-pen mr-1"></i>Edit</button>'
                    + '<button data-post="toggle" data-id="' + esc(j.id) + '" class="' + btn + 'text-slate-600 bg-slate-100 hover:bg-slate-200">' + (closed ? 'Reopen' : 'Close posting') + '</button></div>'
                    + (j.id === selected ? ranking(j) : '') + '</div>'; }).join('')
                : '<div class="' + card + ' p-8 text-center text-[12.5px] text-slate-400">No postings yet. Post an internship or a job to start receiving applicants.</div>');
            if(sel && params.get('job')) document.querySelector('.ring-2')?.scrollIntoView({block: 'start'});
        };
        document.addEventListener('change', (e) => {
            const s = e.target.closest('select[data-jobstatus]'); if(!s) return;
            setJobAppStatus(s.dataset.jobstatus, s.dataset.job, s.value, company);
            showToast('Application status set to ' + s.value + '.', 'success');
            render();
        });
        const openForm = (id) => {
            const j = id ? allPostings()[id] : {type: 'Internship · Onsite', course: PROGRAM_COURSE[me.program] || 'BSCS', requirements: [], skills: []};
            const [kind, arr] = (j.type || '').split(' · ');
            const opt = (list, v) => list.map(x => '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('');
            const lab = (t, input) => '<label class="block mb-3"><span class="text-[12.5px] font-medium text-slate-600 block mb-1">' + t + '</span>' + input + '</label>';
            showModal(id ? 'Edit posting' : 'New posting', lab('Title', '<input id="psTitle" class="' + field + '" value="' + esc(j.title || '') + '">')
              + '<div class="grid grid-cols-3 gap-2">' + lab('Type', '<select id="psKind" class="' + field + '">' + opt(['Internship', 'Full-time', 'Part-time'], kind) + '</select>') + lab('Setup', '<select id="psArr" class="' + field + '">' + opt(['Onsite', 'Hybrid', 'Remote'], arr) + '</select>') + lab('Course', '<select id="psCourse" class="' + field + '">' + opt([...new Set(Object.values(PROGRAM_COURSE))], j.course) + '</select>') + '</div>'
              + lab('Location', '<input id="psLoc" class="' + field + '" placeholder="ex. Imus, Cavite" value="' + esc(j.location || '') + '">') + lab('Pay / allowance', '<input id="psPay" class="' + field + '" value="' + esc(j.salary || '') + '">')
              + lab('Description', '<textarea id="psDesc" rows="3" class="' + field + '">' + esc(j.description || '') + '</textarea>') + lab('Requirements (one per line)', '<textarea id="psReq" rows="3" class="' + field + '">' + esc((j.requirements || []).join('\n')) + '</textarea>')
              + lab('Skills to match (comma separated)', '<input id="psSkills" class="' + field + '" placeholder="ex. SQL, Python, Communication" value="' + esc((j.skills || []).map(x => x[0]).join(', ')) + '">')
              + lab('Application deadline', '<input id="psDeadline" type="date" class="' + field + '" value="' + esc(j.deadlineISO || '') + '">')
              + '<div class="flex justify-end gap-2.5 mt-2"><button data-pclose class="text-[12.5px] font-medium text-slate-500 px-3.5 py-2">Cancel</button><button data-post="save" data-id="' + esc(id || '') + '" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">' + (id ? 'Save' : 'Post') + '</button></div>');
        };
        document.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-post]'); if(!b) return;
            const id = b.dataset.id, act = b.dataset.post;
            if(act === 'new' || act === 'edit') return openForm(act === 'edit' ? id : '');
            if(act === 'view'){ selected = selected === id ? '' : id; return render(); }
            const all = getJSON(POSTINGS_KEY, {}), cur = allPostings()[id] || {};
            if(act === 'toggle'){
                if(cur.status !== 'closed' && !await askConfirm('Close "' + cur.title + '"? Students will no longer see it.')) return;
                all[id] = Object.assign(all[id] || {}, {status: cur.status === 'closed' ? 'open' : 'closed'});
                logAudit((cur.status === 'closed' ? 'Reopened' : 'Closed') + ' the posting ' + cur.title + ' (' + company + ')');
                showToast(cur.status === 'closed' ? 'Posting reopened. Students can apply again.' : 'Posting closed. Students no longer see it.', 'info');
            }
            if(act === 'save'){
                const v = (x) => document.getElementById(x).value.trim(), skills = v('psSkills').split(',').map(x => x.trim()).filter(Boolean);
                if(!v('psTitle') || !v('psLoc') || !skills.length) return showToast('Add the title, location and at least one skill.', 'warn');
                const key = id || 'post-' + vaultId();
                all[key] = Object.assign(all[key] || {}, {company, title: v('psTitle'), type: v('psKind') + ' · ' + v('psArr'), course: v('psCourse'), location: v('psLoc'), salary: v('psPay'), description: v('psDesc'),
                    requirements: v('psReq').split('\n').map(x => x.trim()).filter(Boolean), skills: skills.map(x => [x]), deadlineISO: v('psDeadline'),
                    deadline: v('psDeadline') ? 'Application deadline: ' + formatDate(v('psDeadline')) : (cur.deadline || ''), status: cur.status || 'open', postedAt: cur.postedAt || todayISO()});
                logAudit((id ? 'Updated' : 'Posted') + ' ' + v('psTitle') + ' (' + company + ')');
                closeModal(modal);
                selected = key;
                showToast(id ? 'Posting saved.' : 'Posted. Students can now see it in Job Matching.', 'success');
            }
            localStorage.setItem(POSTINGS_KEY, JSON.stringify(all));
            render();
        });
        render();
    }
})();
