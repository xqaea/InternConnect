let rosterMembers = [];

function loadRoster(){
    const code = activeClassCode();
    rosterMembers = rosterMembersFor(code);
}
function memberName(m){
    return '<div><a href="' + profileLink(m.name) + '" class="font-semibold text-slate-900 hover:text-sky-700 hover:underline">' + esc(m.name) + '</a>' + (m.requested ? ' <span class="ml-1 text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Alumni requested</span>' : '') + '</div>';
}
function setMember(m, patch){
    Object.assign(m, patch);
    if(m.real) updateUser(m.id, 'student', patch);
    // Real students that went through Placements also keep a placement record that must follow the roster status
    if(m.placement || m.sample || (m.real && getPlacementStore()[m.name])){
        const p = placementList().find(x => x.name === m.name) || {};
        const next = {rosterPatch: Object.assign({}, p.rosterPatch, patch)};
        const status = patch.status === 'alumni' ? 'Completed' : patch.status === 'withdrawn' ? 'Withdrawn' : '';
        if(status) Object.assign(next, {status, history: (p.history || []).concat({status, date: todayISO()})});
        savePlacement(m.name, next);
    }
}

function renderRoster(){
    const cls = activeClass();
    if(!cls){ document.getElementById('rosterTitle').textContent = 'No batch selected'; return; }
    document.getElementById('rosterTitle').textContent = cls.term;
    document.getElementById('rosterMeta').textContent = (cls.program || '') + ' · Class Code ' + cls.code;
    const badge = document.getElementById('rosterStatus');
    badge.textContent = capitalize(cls.status);
    badge.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[cls.status];
    document.getElementById('closeBatchBtn').classList.toggle('hidden', cls.status !== 'active');

    const interns = rosterMembers.filter(m => m.status === 'intern');
    const alumni = rosterMembers.filter(m => m.status === 'alumni');
    const withdrawn = rosterMembers.filter(m => m.status === 'withdrawn');
    document.getElementById('rosterInternsCount').textContent = '(' + interns.length + ')';
    document.getElementById('rosterAlumniCount').textContent = '(' + alumni.length + ')';
    document.getElementById('rosterWithdrawnCount').textContent = '(' + withdrawn.length + ')';

    const fill = (id, rows) => {
        document.getElementById(id).innerHTML = rows.join('');
        document.getElementById(id + 'Empty').classList.toggle('hidden', rows.length > 0);
    };
    fill('rosterInternsBody', interns.map(m => {
        if(!m.company || m.company === '—'){
            return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
                + '<td class="px-4 py-3 text-slate-600">Not placed yet</td>'
                + '<td class="px-4 py-3 text-slate-500">-</td>'
                + '<td class="px-4 py-3 text-slate-500">-</td></tr>';
        }
        const pct = Math.min(100, Math.round(m.hours / REQUIRED_HOURS * 100));
        const done = m.hours >= REQUIRED_HOURS;
        const evalIn = done && hasDoc(m.company, m.name, 'Supervisor evaluation');
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + esc(m.company) + '</td>'
          + '<td class="px-4 py-3"><div class="flex items-center gap-2"><div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-sky-600" style="width:' + pct + '%"></div></div><span class="text-[11.5px] text-slate-500">' + m.hours + ' / ' + REQUIRED_HOURS + '</span></div></td>'
          + '<td class="px-4 py-3"><div class="flex gap-2">'
          + '<button data-act="files" data-id="' + esc(m.id) + '" class="text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md transition"><i class="fa-solid fa-folder-open mr-1"></i>Files</button>'
          + '<button data-act="complete" data-id="' + esc(m.id) + '" ' + (!done ? 'disabled title="Hours not complete yet"' : evalIn ? '' : 'title="Upload the signed supervisor evaluation first"') + ' class="text-[11px] font-semibold px-2.5 py-1 rounded-md transition ' + (!done ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : evalIn ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100') + '">' + (done && !evalIn ? '<i class="fa-solid fa-lock mr-1 text-[9px]"></i>' : '') + 'Mark completed</button>'
          + '<button data-act="withdraw" data-id="' + esc(m.id) + '" class="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition">Withdraw</button>'
          + '</div></td></tr>';
    }));
    fill('rosterAlumniBody', alumni.map(m => {
        const date = m.completedAt || todayISO();
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + formatDate(date) + '</td>'
          + '<td class="px-4 py-3"><select data-act="employment" data-id="' + esc(m.id) + '" class="border border-slate-300 rounded-md px-2 py-1 text-[11.5px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400">'
          +   '<option value="seeking"' + (m.employment === 'employed' ? '' : ' selected') + '>Seeking work</option>'
          +   '<option value="employed"' + (m.employment === 'employed' ? ' selected' : '') + '>Employed</option></select></td>'
          + '<td class="px-4 py-3 text-slate-600">' + retainUntil(date) + '</td></tr>';
    }));
    fill('rosterWithdrawnBody', withdrawn.map(m => {
        const date = m.withdrawnAt || todayISO();
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + formatDate(date) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + retainUntil(date) + '</td></tr>';
    }));
}

function initCoordinatorRoster(){
  if(!document.getElementById('rosterInternsBody')) return;
    loadRoster();
    renderRoster();
    on('backToClassesBtn', 'click', () => goTo('classes'));
    on('goRequestsBtn', 'click', () => goTo('requests'));

    document.getElementById('tab-roster').addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-act]');
        if(!btn || btn.disabled) return;
        const m = rosterMembers.find(x => x.id === btn.dataset.id);
        if(!m) return;
        if(btn.dataset.act === 'files'){ openInternFiles(m.company, m.name); return; }
        if(btn.dataset.act === 'complete'){
            if(!hasDoc(m.company, m.name, 'Supervisor evaluation')){
                askConfirm('There is no signed supervisor evaluation scan in ' + m.name + "'s vault folder yet.\n\nOpen the folder to upload it?").then(ok => { if(ok) openInternFiles(m.company, m.name); });
                return;
            }
            setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking', requested: false});
            if(m.real) saveAlumniRequests(getAlumniRequests().map(r => (r.email === m.id && r.status === 'pending') ? Object.assign({}, r, {status: 'approved'}) : r));
            logAudit('Marked ' + m.name + ' as completed (Alumni)');
            showToast(m.name + ' is now an alumni. Records kept until ' + retainUntil(todayISO()) + '.', 'success');
        }
        if(btn.dataset.act === 'withdraw'){
            if(!await askConfirm('Mark ' + m.name + ' as withdrawn? They will stay in this batch records.')) return;
            setMember(m, {status: 'withdrawn', withdrawnAt: todayISO()});
            showToast(m.name + ' was marked as withdrawn.', 'warn');
        }
        renderRoster();
    });
    document.getElementById('tab-roster').addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-act="employment"]');
        if(!sel) return;
        const m = rosterMembers.find(x => x.id === sel.dataset.id);
        setMember(m, {employment: sel.value});
        showToast(m.name + ' marked as ' + (sel.value === 'employed' ? 'employed.' : 'seeking work.'), 'info');
    });

    // Close Batch: interns with complete hours become alumni, the rest stay in this batch
    on('closeBatchBtn', 'click', async () => {
        const ready = rosterMembers.filter(m => m.status === 'intern' && m.hours >= REQUIRED_HOURS && hasDoc(m.company, m.name, 'Supervisor evaluation'));
        const ongoing = rosterMembers.filter(m => m.status === 'intern').length - ready.length;
        if(!await askConfirm('Close this batch? ' + ready.length + ' intern(s) with complete hours and a supervisor evaluation will become alumni. ' + ongoing + ' will stay until they finish. No new students can join.')) return;
        if((getJSON('ic_session', {}) || {}).databaseAccount){
            try{
                await window.ICCoordinatorApi.updateBatch(activeClassCode(), {status: 'closed'});
                await window.syncCoordinatorState();
            }catch(error){ return showToast(error.message || 'Could not close this batch. Refresh and try again.', 'warn'); }
        }
        ready.forEach(m => setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking'}));
        updateClass(activeClassCode(), {status: 'closed'});
        renderRoster();
        showToast('Batch closed. ' + ready.length + ' moved to Alumni, ' + ongoing + ' still ongoing.', 'success');
    });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initRoster = initCoordinatorRoster;

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initRoster?.();
    window.ICCore?.coordinator?.initDeletions?.();
  }, { once: true });
})();
