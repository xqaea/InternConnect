function pendingCard(u){
    const isStudent = u.role === 'student';
    const title = isStudent ? u.name : (u.company || u.name);
    const initials = (title || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatar = isStudent
        ? '<div class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-[12px] font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
        : '<div class="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><i class="fa-solid fa-building"></i></div>';
    const when = u.requestedAt ? 'requested ' + formatDate(u.requestedAt) : 'new sign up';
    const meta = isStudent
        ? esc(u.studentNumber || u.email || '') + ' · ' + when
        : (u.contact ? 'Requested link · ' + esc(u.contact) : esc(u.email || '') + ' · ' + when);
    const id = u.sample ? ' data-sample="' + u.sample + '"' : ' data-email="' + esc(u.email) + '"';
    return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3"' + id + ' data-userrole="' + u.role + '" data-name="' + esc(title) + '">'
      + '<div class="flex items-center gap-3">' + avatar + '<div><div class="font-semibold text-slate-900 text-sm">' + esc(title) + '</div><div class="text-[11.5px] text-slate-400">' + meta + '</div></div></div>'
      + '<div class="flex gap-2 flex-shrink-0">'
      + '<button class="join-approve text-[12px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-check mr-1"></i>Approve</button>'
      + '<button class="join-reject text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>'
      + '</div></div>';
}

function renderJoinRequests(){
    const code = activeClassCode();
    const done = getJSON(SAMPLE_JOINS_KEY, []);
    const real = getUsers().filter(u => u.classCode === code && u.status === 'pending')
        .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
    const samples = code === SEED_CODE ? SAMPLE_JOINS.filter(x => !done.includes(x.sample)) : [];
    const fill = (id, role, empty) => {
        const items = real.filter(u => u.role === role).concat(samples.filter(x => x.role === role));
        document.getElementById(id).innerHTML = items.length ? items.map(pendingCard).join('') : '<p class="text-[12.5px] text-slate-400">' + empty + '</p>';
    };
    fill('wr-students', 'student', 'No pending student requests.');
    fill('wr-partners', 'partnercompany', 'No pending partner company requests.');
    updateRequestCounts();
}

function initCoordinatorJoinRequests(){
    if(document.getElementById('wr-students')) renderJoinRequests();
}

window.ICCore.coordinator.initJoinRequests = initCoordinatorJoinRequests;
window.ICCore.coordinator.initRequests = initCoordinatorJoinRequests;

// Approve and Reject (approved students become Interns, rejected sign ups are deleted). Both are written to the audit trail.
document.addEventListener('click', async (e) => {
    const approve = e.target.closest('.join-approve');
    const reject = e.target.closest('.join-reject');
    if(!approve && !reject) return;
    const card = (approve || reject).closest('.bg-white');
    const name = card.dataset.name;   // not the first .font-semibold: that is the avatar initials
    const email = card.dataset.email, role = card.dataset.userrole, sampleId = card.dataset.sample;
    const isPartner = role === 'partnercompany';
    if(reject && !await askConfirm('Reject ' + name + '? Their sign up will be removed and they will need to register again.', {title: 'Reject request?', ok: 'Reject', danger: true})) return;
    if(email){
        if(approve){
            const patch = {status: role === 'student' ? 'intern' : 'active', approvedAt: todayISO()};
            if(isPartner){
                const u = getUsers().find(x => x.email === email && x.role === role) || {}, typed = (u.company || '').trim();
                patch.company = partnerCompanies().find(n => n.toLowerCase() === typed.toLowerCase()) || typed;
            }
            updateUser(email, role, patch);
        }
        else saveUsers(getUsers().filter(u => !(u.email === email && u.role === role)));
    } else if(sampleId){
        localStorage.setItem(SAMPLE_JOINS_KEY, JSON.stringify(getJSON(SAMPLE_JOINS_KEY, []).concat(sampleId)));
    }
    logAudit((approve ? 'Approved ' : 'Rejected ') + name + (isPartner ? "'s partner link request" : "'s request to join") + ' (' + activeClassCode() + ')', approve ? 'Success' : 'Deleted');
    renderJoinRequests();
    updateSidebarRequestBadge();
    if(approve) showToast(name + (isPartner ? ' approved and added to the Partner & MOA Directory.' : ' approved and added to the class.'), 'success');
    else showToast(name + "'s request was rejected.", 'warn');
});

function currentCoordinator(){ return getJSON('ic_session', null) || {}; }

function alumniRequestCard(req){
    const date = req.requestedAt ? new Date(req.requestedAt).toLocaleString([], {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'}) : '—';
    return `<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4" data-alumni-request-email="${esc(req.email)}">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[12px] font-semibold flex-shrink-0">${esc((req.studentName || '?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</div>
        <div class="min-w-0">
          <div class="font-semibold text-slate-900 text-sm truncate">${esc(req.studentName || req.email)}</div>
          <div class="text-[11.5px] text-slate-400 truncate">${esc(req.email)} · ${esc(req.program || '')}</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Requested ${esc(date)} · ${esc(req.classCode || '')}</div>
        </div>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <button class="alumni-approve text-[12px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-check mr-1"></i>Approve</button>
        <button class="alumni-reject text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>
      </div>
    </div>`;
}

function renderAlumniRequestSection(){
    const marker = document.getElementById('alumniRequestSection');
    const wr = document.getElementById('wr-students');
    if(!wr && !marker) return;
    const me = currentCoordinator();
    if(me.role !== 'coordinator') return;
    const filtered = getAlumniRequests().filter(r => r.status === 'pending' && (!r.coordinatorEmail || r.coordinatorEmail === me.email) && (!r.classCode || r.classCode === activeClassCode()));
    if(marker){
        marker.querySelector('[data-alumni-count]').textContent = '(' + filtered.length + ')';
        const list = marker.querySelector('[data-alumni-list]');
        list.innerHTML = filtered.length ? filtered.map(alumniRequestCard).join('') : '<p class="text-[12.5px] text-slate-400">No pending alumni status requests.</p>';
        return;
    }
    const section = document.createElement('section');
    section.id = 'alumniRequestSection';
    section.className = 'space-y-3 mb-5';
    section.innerHTML = `<div class="flex items-center justify-between"><div><h2 class="text-base font-bold text-slate-900">Alumni Status Requests <span class="text-[11px] font-semibold text-slate-400" data-alumni-count>(${filtered.length})</span></h2><p class="text-[12px] text-slate-500 mt-0.5">Students who completed their OJT and requested Alumni status.</p></div></div><div class="space-y-3" data-alumni-list>${filtered.length ? filtered.map(alumniRequestCard).join('') : '<p class="text-[12.5px] text-slate-400">No pending alumni status requests.</p>'}</div>`;
    const main = document.querySelector('main');
    if(main) main.insertBefore(section, main.firstElementChild);
}

function processAlumniRequest(email, action){
    const me = currentCoordinator();
    const requests = getAlumniRequests();
    const req = requests.find(r => r.email === email && r.status === 'pending' && (!r.coordinatorEmail || r.coordinatorEmail === me.email));
    if(!req) return;
    if(action === 'approve'){
        const student = getUsers().find(u => u.role === 'student' && u.email === email) || {};
        const placement = placementList(req.classCode || student.classCode).find(p => p.email === email || p.name === student.name);
        if(!placement || placement.hours < REQUIRED_HOURS || !['Hours complete', 'Completed'].includes(placement.status)){
            showToast(req.studentName + ' has not completed the required OJT hours.', 'warn');
            return;
        }
        if(!hasDoc(placement.company, placement.name, 'Supervisor evaluation')){
            showToast('Upload the signed supervisor evaluation of ' + esc(req.studentName) + ' to their vault folder first.', 'warn');
            return;
        }
        updateUser(email, 'student', {status:'alumni', alumniApprovedAt: todayISO(), completedAt: todayISO(), employment: 'seeking'});
        savePlacement(placement.name, {status: 'Completed', history: (placement.history || []).concat({status: 'Completed', date: todayISO()})});
        req.status = 'approved';
        req.approvedAt = new Date().toISOString();
        saveAlumniRequests(requests);
        showToast(req.studentName + ' is now an Alumni.', 'success');
    } else {
        updateUser(email, 'student', {status:'intern', alumniRejectedAt: todayISO()});
        req.status = 'rejected';
        req.rejectedAt = new Date().toISOString();
        saveAlumniRequests(requests);
        showToast(req.studentName + "'s alumni request was rejected.", 'warn');
    }
    renderAlumniRequestSection();
}

document.addEventListener('click', async (e) => {
    const approve = e.target.closest('.alumni-approve');
    const reject = e.target.closest('.alumni-reject');
    if(approve || reject){
        const card = (approve || reject).closest('[data-alumni-request-email]');
        if(reject && card && !await askConfirm('Reject this alumni request? The student stays an intern.')) return;
        if(card) processAlumniRequest(card.dataset.alumniRequestEmail, approve ? 'approve' : 'reject');
    }
});
function initCoordinatorAlumniRequests(){
    if(document.getElementById('wr-students') || document.body.dataset.page === 'requests') renderAlumniRequestSection();
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initAlumniRequests = initCoordinatorAlumniRequests;

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    window.ICCore?.coordinator?.initRequests?.();
    window.ICCore?.coordinator?.initAlumniRequests?.();
    window.ICCore?.coordinator?.initJoinRequests?.();
  }, { once: true });
})();
