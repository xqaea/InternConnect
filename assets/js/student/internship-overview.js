function initStudentInternshipOverview(me, mine, myTasks, mySub, renderNotifs){
    const card = (title, body, right) => '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div class="flex items-center justify-between gap-2 mb-3"><h2 class="font-semibold text-slate-900 text-sm">' + title + '</h2>' + (right || '') + '</div>' + body + '</div>';
    const field = 'border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    const NEXT = {
        'Not placed': 'Record where you applied so your coordinator can endorse you.',
        'Applied': 'Your coordinator will review your application and prepare your endorsement letter.',
        'Endorsed': 'Bring your signed endorsement letter to the company. Waiting for their acceptance letter.',
        'Accepted': 'Accepted! Waiting for your coordinator to confirm your start date and schedule.',
        'Deployed': 'You can clock in and out on the Attendance page.',
        'Hours complete': 'Hours complete. Waiting for your supervisor evaluation.',
        'Completed': 'OJT completed. Your records are kept for 5 years after completion.',
        'Withdrawn': 'Your OJT was withdrawn. Talk to your coordinator.'
    };

    // ---- Overview: my internship, my files, data deletion (alumni) ----
    const ov = document.getElementById('tab-overview');
    let signedLetters=[],lettersState=me.databaseAccount?'loading':'prototype';
    async function loadLetters(){
        lettersState='loading';renderStudentOverview();
        try{signedLetters=(await window.ICStudentApi.placementDocuments()).documents;lettersState='ready';}
        catch(error){lettersState='error';}
        renderStudentOverview();
    }
    function renderStudentOverview(){
        const p = mine();
        document.getElementById('myInternship')?.remove();
        const steps = PLACEMENT_STEPS.slice(1);
        const at = steps.indexOf(p.status);
        const progress = '<div class="flex flex-wrap gap-1.5 mb-3">' + steps.map((st, i) => '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border '
            + (i < at || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i === at ? 'bg-sky-600 text-white border-sky-600' : 'text-slate-400 border-slate-200') + '">' + st + '</span>').join('') + '</div>';
        let body = progress + '<p class="text-[12.5px] text-slate-600">' + (p.company ? '<strong>' + esc(p.company) + '</strong>' + (p.position ? ' · ' + esc(p.position) : '') + ' · ' : '') + NEXT[p.status] + '</p>';
        if(p.status === 'Not placed' && !partnerNames().length) body += '<p class="text-[12px] text-slate-500 mt-3">No partner companies are linked to your batch yet. Your coordinator has to approve one first.</p>';
        else if(p.status === 'Not placed') body += '<div class="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mt-3">'
            + '<select id="stApplyCompany" class="' + field + '">' + partnerNames().map(c => '<option>' + esc(c) + '</option>').join('') + '</select>'
            + '<input id="stApplyPosition" placeholder="Position (e.g. Web Developer Intern)" class="' + field + '">'
            + '<button id="stApplyBtn" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">Record application</button></div>'
            + '<p class="text-[11px] text-slate-400 mt-1.5">One active application at a time. Your coordinator can also record it for you.</p>';
        if(p.status === 'Applied' && p.source === 'student') body += '<button id="stCancelApply" class="mt-3 text-[12px] font-semibold text-red-600 hover:text-red-700">Cancel application</button>';
        if(['Deployed', 'Hours complete'].includes(p.status)){
            const sc = scheduleOf(p);
            body += '<div class="mt-3 grid sm:grid-cols-2 gap-2 text-[12.5px]"><div class="rounded-lg border border-slate-200 px-3 py-2"><div class="text-[10.5px] text-slate-500">Hours rendered</div><div class="font-bold text-slate-900">' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + '</div></div>'
                + '<div class="rounded-lg border border-slate-200 px-3 py-2"><div class="text-[10.5px] text-slate-500">Schedule (' + sc.mode + ')</div><div class="font-semibold text-slate-800">' + scheduleText(sc) + '</div><div class="text-[10.5px] text-slate-400">Late after ' + fmtClock(clockMins(sc.timeIn) + sc.grace) + '</div></div></div>';
        }
        const docs = me.databaseAccount?[]:internDocs(p.company, p.name);
        const files = me.databaseAccount ? (lettersState==='loading'?'<p role="status" class="text-[12.5px] text-slate-400">Loading your letters…</p>'
            :lettersState==='error'?'<p class="text-[12.5px] text-slate-500">Your letters could not be loaded.</p><button type="button" data-retry-letters class="text-[12px] text-sky-700 mt-2">Try again</button>'
            :signedLetters.length?'<div class="divide-y divide-slate-100">'+signedLetters.map(file=>'<button type="button" data-st-letter="'+esc(file.kind)+'" data-st-letter-id="'+esc(file.id || '')+'" class="w-full text-left flex items-center justify-between gap-3 py-2"><span><span class="block text-[12.5px] text-slate-800">'+(file.kind==='endorsement'?'Endorsement letter':'Acceptance letter')+'</span><span class="text-[10.5px] text-slate-400">'+esc(file.name)+'</span></span><span class="text-[12px] text-sky-700">View</span></button>').join('')+'</div>'
            :'<p class="text-[12.5px] text-slate-400">Your letters will appear here when uploaded to your folder in the company vault.</p>')
            : !p.company ? '<p class="text-[12.5px] text-slate-400">Your folder is created once you apply to a partner company.</p>'
            : docs.length ? '<div class="divide-y divide-slate-100">' + docs.map(f => '<div data-st-file="' + esc(f.id) + '" role="button" tabindex="0" class="flex items-center justify-between gap-3 py-2 cursor-pointer"><div class="flex items-center gap-2.5"><i class="fa-solid fa-file-pdf text-red-400"></i><div><div class="text-[12.5px] text-slate-800">' + esc(f.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(f.type) + ' · ' + formatDate(f.uploadedAt) + (f.version > 1 ? ' · v' + f.version : '') + '</div></div></div><span class="text-[10.5px] text-slate-400">view only</span></div>').join('') + '</div>'
            : '<p class="text-[12.5px] text-slate-400">No signed scans yet.</p>';
        let deletion = '';
        if(p.status === 'Completed'){
            const r = getDeletionRequests().find(x => x.name === p.name);
            const keep = retainUntil(alumniCompletedAt(p));
            deletion = card('My data', !r ? '<p class="text-[12.5px] text-slate-600 mb-3">You can ask to delete your profile, resume and job-matching data. Your OJT record (hours, attendance, approved logs, signed scans) is kept read-only until <strong>' + keep + '</strong>.</p><button id="stDeleteReq" class="text-[12.5px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-md">Request data deletion</button>'
                : r.status === 'pending' ? '<p class="text-[12.5px] text-slate-600">Deletion requested on ' + formatDate(r.requestedAt) + '. Waiting for your coordinator.</p>'
                : r.status === 'held' ? '<div class="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"><strong>On hold (' + formatDate(r.heldAt) + '):</strong> ' + esc(r.holdReason) + '</div>'
                : '<p class="text-[12.5px] text-slate-600">Your profile data was deleted on ' + formatDate(r.processedAt) + '. Your OJT record is kept until ' + keep + '.</p>');
        }
        ov.children[0].insertAdjacentHTML('afterend', '<div id="myInternship" class="grid lg:grid-cols-[1fr_380px] gap-4 items-start">' + card('My Internship', body, placementBadge(p.status)) + '<div class="space-y-4">' + card('My files', files, p.company ? '<span class="text-[10.5px] text-slate-400">' + esc(p.company) + ' vault</span>' : '') + deletion + '</div></div>');
        const stats = ov.querySelectorAll('.grid.grid-cols-2 > div');
        if(stats[0]){ const pct = Math.min(100, Math.round((p.hours || 0) / REQUIRED_HOURS * 100)); stats[0].querySelector('.text-lg').innerHTML = (p.hours || 0) + ' <span class="text-[12px] font-medium text-slate-400">/ ' + REQUIRED_HOURS + ' hrs</span>'; stats[0].querySelector('.bg-sky-600').style.width = pct + '%'; }
        if(stats[1]) stats[1].querySelector('.text-2xl').textContent = myTasks().filter(t => t.status === 'open' && !['Pending Review', 'Verified'].includes(mySub(t.id).status)).length;
        if(stats[2]){ const open = myJobApps(me).filter(a => JOB_OPEN.includes(jobAppStatus(a, me))); stats[2].querySelector('.text-2xl').textContent = open.length + (['Applied', 'Endorsed', 'Accepted'].includes(p.status) && !open.some(a => a.company === p.company) ? 1 : 0); }
        if(stats[3]){ const scores = Object.values(jobDetails).filter(j => isInternshipJob(j) !== (me.status === 'alumni')).map(j => jobMatch(j, me).score); stats[3].querySelector('.text-2xl').textContent = (scores.length ? Math.max(...scores) : 0) + '%'; }
        renderNotifs();
    }
    if(ov){
        renderStudentOverview();
        if(me.databaseAccount)loadLetters();
        ov.addEventListener('click', async (e) => {
            const p = mine();
            if(e.target.closest('[data-retry-letters]')){loadLetters();return;}
            const letterButton=e.target.closest('[data-st-letter]');
            if(letterButton){
                if(letterButton.disabled)return;
                letterButton.disabled=true;
                try{const result=letterButton.dataset.stLetterId?await window.ICVaultApi.read(letterButton.dataset.stLetterId):await window.ICStudentApi.placementDocument(letterButton.dataset.stLetter);window.viewStudentDocument(result.document);}
                catch(error){showToast(error.message || 'This letter could not be opened.','warn');}
                finally{letterButton.disabled=false;}
                return;
            }
            const documentRow = e.target.closest('[data-st-file]');
            if(documentRow){try{window.viewStudentDocument(internDocs(p.company,p.name).find(f=>f.id===documentRow.dataset.stFile));}catch(error){showToast(error.message,'warn');}return;}
            if(e.target.closest('#stApplyBtn')){
                const company = document.getElementById('stApplyCompany').value, position = document.getElementById('stApplyPosition').value.trim(), date = todayISO();
                savePlacement(p.name, {status: 'Applied', company, position, source: 'student', email: me.email, history: (p.history || []).concat({status: 'Applied', date, note: company + (position ? ' · ' + position : '') + ' · by student'})});
                showToast('Application to ' + esc(company) + ' recorded. Your coordinator will review it.', 'success');
            }
            if(e.target.closest('#stCancelApply')){
                if(!await askConfirm('Cancel your application to ' + p.company + '?')) return;
                savePlacement(p.name, {status: 'Not placed', company: '', position: '', source: '', history: (p.history || []).concat({status: 'Not placed', date: todayISO(), note: 'Application cancelled by student'})});
                showToast('Application cancelled.', 'warn');
            }
            if(e.target.closest('#stDeleteReq')){
                if(!await askConfirm('Request deletion of your profile, resume and job-matching data?')) return;
                const all = getDeletionRequests().concat({name: p.name, classCode: me.classCode || SEED_CODE, requestedAt: todayISO(), status: 'pending', completedAt: alumniCompletedAt(p)});
                localStorage.setItem(DELETION_KEY, JSON.stringify(all));
                showToast('Deletion request sent to your coordinator.', 'success');
            }
            if(e.target.closest('#stApplyBtn, #stCancelApply, #stDeleteReq')) renderStudentOverview();
        });
        ov.addEventListener('keydown', e => { if(e.target.matches('[data-st-file]') && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); e.target.click(); } });
    }


}
