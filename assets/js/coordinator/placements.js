/* ============ Placements Page ============ */

const NEXT_STEP = {
    'Not placed': ['apply', 'Record application'],
    'Applied': ['endorse', 'Mark endorsed'],
    'Endorsed': ['accept', 'Mark accepted'],
    'Accepted': ['deploy', 'Confirm deployment']
};
const AFTER_STEP = {'Deployed': 'Monitoring attendance', 'Hours complete': 'Ready to mark completed', 'Completed': 'Alumni', 'Withdrawn': 'Withdrawn'};
const placementOrder = (p) => { const i = PLACEMENT_STEPS.indexOf(p.status); return i < 0 ? 99 : i; };

function scanChip(p, type, label){
    const ok = hasDoc(p.company, p.name, type);
    return '<span class="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border '
      + (ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-400 bg-slate-50 border-slate-200') + '" title="' + (ok ? 'Signed scan is in the vault' : 'No signed scan yet') + '">'
      + '<i class="fa-solid ' + (ok ? 'fa-check' : 'fa-minus') + ' text-[9px]"></i>' + label + '</span>';
}
function placementRow(p){
    const next = NEXT_STEP[p.status];
    const action = next
        ? '<button data-pl-act="' + next[0] + '" class="text-[11.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-2.5 py-1 rounded-md transition whitespace-nowrap">' + next[1] + '</button>'
          + (['Applied', 'Endorsed', 'Accepted'].includes(p.status) ? '<button data-pl-act="decline" class="ml-2 text-[11px] text-slate-500 hover:text-red-600 whitespace-nowrap">Not accepted</button>' : '')
        : '<span class="text-[11.5px] text-slate-400">' + (p.status === 'Hours complete' ? (hasDoc(p.company, p.name, 'Supervisor evaluation') ? 'Ready to mark completed in the Roster' : 'Needs supervisor evaluation') : (AFTER_STEP[p.status] || '')) + '</span>';
    return '<tr data-name="' + esc(p.name) + '">'
      + '<td class="px-5 py-3"><a href="' + profileLink(p.name) + '" class="font-medium text-slate-900 hover:text-sky-700 hover:underline whitespace-nowrap">' + esc(p.name) + '</a>'
      + (p.studentNo ? '<div class="text-[10.5px] text-slate-400">' + esc(p.studentNo) + '</div>' : '') + '</td>'
      + '<td class="px-5 py-3 text-[13px] text-slate-600">' + (p.company ? esc(p.company) : '<span class="text-slate-400">—</span>') + '</td>'
      + '<td class="px-5 py-3">' + placementBadge(p.status) + '</td>'
      + '<td class="px-5 py-3"><div class="flex gap-1.5 flex-wrap">' + scanChip(p, 'Endorsement letter', 'Endorsement') + scanChip(p, 'Acceptance letter', 'Acceptance') + '</div></td>'
      + '<td class="px-5 py-3">' + action + '</td>'
      + '<td class="px-5 py-3 text-right whitespace-nowrap">'
      + (p.company ? '<button data-pl-act="files" class="text-[11.5px] font-medium text-slate-500 hover:text-sky-700"><i class="fa-solid fa-folder-open mr-1"></i>Files</button>' : '')
      + '<a href="' + profileLink(p.name) + '" class="ml-3 text-[11.5px] font-medium text-sky-600 hover:text-sky-700">Profile</a></td></tr>';
}

let placementStage = new URLSearchParams(window.location.search).get('stage') || '';
function renderPlacements(){
    const all = placementList();
    document.getElementById('placementStages').innerHTML = [''].concat(PLACEMENT_STEPS).map(stage => {
        const n = stage ? all.filter(p => p.status === stage).length : all.length;
        return '<button data-stage="' + stage + '" class="text-left rounded-lg border px-3 py-2 transition ' + (stage === placementStage ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300') + '">'
          + '<div class="text-[10.5px] text-slate-500 truncate">' + (stage || 'All students') + '</div><div class="text-lg font-bold text-slate-900 leading-tight">' + n + '</div></button>';
    }).join('');
    const q = document.getElementById('placementSearch').value.toLowerCase().trim();
    const list = all.filter(p => (!placementStage || p.status === placementStage) && (!q || (p.name + ' ' + p.company).toLowerCase().includes(q)))
        .sort((a, b) => placementOrder(a) - placementOrder(b) || a.name.localeCompare(b.name));
    document.getElementById('placementTbody').innerHTML = list.map(placementRow).join('');
    list.forEach((p, i) => { if(p.source === 'student') document.getElementById('placementTbody').children[i]?.querySelector('td')?.insertAdjacentHTML('beforeend', '<span class="ml-1 text-[9.5px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">by student</span>'); });
    document.getElementById('placementEmpty').classList.toggle('hidden', list.length > 0);
}

// Moves a student one step; endorse and accept need the signed scan in the vault first
let applyTarget = '';
async function placementAction(name, act){
    const p = placementList().find(x => x.name === name);
    if(!p) return;
    const history = (status, note) => (p.history || []).concat(note ? {status, date: todayISO(), note} : {status, date: todayISO()});
    const needScan = (type) => {
        if(hasDoc(p.company, p.name, type)) return false;
        askConfirm('There is no signed ' + type.toLowerCase() + ' scan in ' + p.name + "'s vault folder yet.\n\nOpen the folder to upload it?").then(ok => { if(ok) openInternFiles(p.company, p.name); });
        return true;
    };
    if(act === 'files'){ openInternFiles(p.company, p.name); return; }
    if(act === 'apply'){
        if(!partnerNames().length){ showToast('No partner companies in this batch yet. Approve a partner company request first.', 'warn'); return; }
        applyTarget = name;
        document.getElementById('applyName').textContent = 'Where did ' + name + ' apply?';
        document.getElementById('applyCompany').innerHTML = partnerNames().map(c => '<option>' + esc(c) + '</option>').join('');
        openModal(document.getElementById('applyModal'));
        return;
    }
    if(act === 'endorse'){
        if(needScan('Endorsement letter')) return;
        savePlacement(name, {status: 'Endorsed', history: history('Endorsed')});
        logAudit('Marked ' + name + ' as endorsed to ' + p.company);
        showToast(esc(name) + ' marked as endorsed to ' + esc(p.company) + '.', 'success');
    }
    if(act === 'accept'){
        if(needScan('Acceptance letter')) return;
        savePlacement(name, {status: 'Accepted', history: history('Accepted')});
        logAudit('Marked ' + name + ' as accepted by ' + p.company);
        showToast(esc(name) + ' was accepted by ' + esc(p.company) + '. Confirm deployment when they start.', 'success');
    }
    if(act === 'deploy'){
        openScheduleModal(p, 'Confirm deployment of ' + name, (sched) => {
            savePlacement(name, {status: 'Deployed', deployedAt: todayISO(), hours: p.hours || 0, schedule: sched, history: history('Deployed')});
            if(p.real) updateUser(p.email, 'student', {company: p.company});
            logAudit('Confirmed deployment of ' + name + ' to ' + p.company + ' (' + scheduleText(sched) + ')');
            showToast(esc(name) + ' is now deployed and appears in the Roster. Attendance monitoring starts today.', 'success');
            renderPlacements();
        });
        return;
    }
    if(act === 'decline'){
        if(!await askConfirm(p.company + ' did not accept ' + name + '? The student goes back to Not placed. Files in the vault are kept.')) return;
        savePlacement(name, {status: 'Not placed', company: '', history: history('Not placed', 'Not accepted by ' + p.company)});
        showToast(esc(name) + ' is back to Not placed.', 'warn');
    }
    renderPlacements();
}

function initCoordinatorPlacements(){
if(!document.getElementById('placementTbody')) return;
    renderPlacements();
    on('placementSearch', 'input', renderPlacements);
    document.getElementById('placementStages').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-stage]');
        if(!btn) return;
        placementStage = btn.dataset.stage;
        renderPlacements();
    });
    document.getElementById('placementTbody').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pl-act]');
        if(btn) placementAction(btn.closest('tr').dataset.name, btn.dataset.plAct);
    });
    const applyModal = document.getElementById('applyModal');
    on('applyCloseBtn', 'click', () => closeModal(applyModal));
    on('applyCancelBtn', 'click', () => closeModal(applyModal));
    on('applySaveBtn', 'click', () => {
        const p = placementList().find(x => x.name === applyTarget);
        const company = document.getElementById('applyCompany').value;
        savePlacement(applyTarget, {status: 'Applied', company, history: (p.history || []).concat({status: 'Applied', date: todayISO(), note: company})});
        closeModal(applyModal);
        renderPlacements();
        showToast(esc(applyTarget) + "'s application to " + esc(company) + ' recorded. Upload the signed endorsement letter to their vault folder.', 'success');
    });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initPlacements = initCoordinatorPlacements;

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    window.ICCore?.coordinator?.initPlacements?.();
  }, { once: true });
})();
