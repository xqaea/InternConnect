let holdFormFor = '';
function deletionCard(r){
    if(r.status === 'anonymized') return '<div class="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap"><div class="flex items-center gap-3">'
        + '<div class="w-9 h-9 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center"><i class="fa-solid fa-user-secret"></i></div>'
        + '<div><div class="font-semibold text-slate-700 text-sm">' + esc(r.name) + '</div><div class="text-[11.5px] text-slate-400">Completed ' + formatDate(r.completedAt) + ' · retention ended ' + retainUntil(r.completedAt) + (r.auto ? ' · no deletion request' : '') + '</div></div></div>'
        + '<span class="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">Anonymized ' + formatDate(r.anonymizedAt) + '</span>'
        + '<p class="w-full text-[11.5px] text-slate-500">The kept OJT record reached the end of its retention period. Name, photos, GPS and signed scans were removed; only anonymous counts remain for reports.</p></div>';
    const p = placementList().find(x => x.name === r.name) || {name: r.name, history: []};
    const done = r.completedAt || alumniCompletedAt(p), keep = retainUntil(done);
    const initials = r.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const head = '<div class="flex items-center justify-between gap-3 flex-wrap"><div class="flex items-center gap-3">'
        + '<div class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-[12px] font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
        + '<div><div class="font-semibold text-slate-900 text-sm"><a href="' + profileLink(r.name) + '" class="hover:text-sky-700">' + esc(r.name) + '</a> <span class="text-slate-400 font-normal">(Alumni)</span></div>'
        + '<div class="text-[11.5px] text-slate-400">Completed ' + formatDate(done) + ' · requested ' + formatDate(r.requestedAt) + '</div></div></div>';
    if(r.status === 'processed') return '<div class="bg-slate-50 rounded-xl border border-slate-200 p-4">' + head
        + '<span class="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">Deleted ' + formatDate(r.processedAt) + '</span></div>'
        + '<p class="text-[11.5px] text-slate-500 mt-3">Profile, resume and job-matching data deleted. OJT record (hours, attendance photos and GPS, approved logs, signed scans) kept read-only until <strong class="text-slate-700">' + keep + '</strong>.</p></div>';

    const gaps = recordGaps(p);
    const btn = 'text-[12px] font-semibold px-3 py-1.5 rounded-md transition ';
    const approve = '<button data-del-act="approve" data-name="' + esc(r.name) + '" ' + (gaps.length ? 'disabled title="Complete the OJT record first"' : '') + ' class="' + btn + (gaps.length ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-white bg-emerald-500 hover:bg-emerald-600') + '"><i class="fa-solid fa-check mr-1"></i>Approve deletion</button>';
    const actions = r.status === 'held'
        ? '<span class="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><i class="fa-solid fa-pause mr-1"></i>On hold</span>' + approve
          + '<button data-del-act="resume" data-name="' + esc(r.name) + '" class="' + btn + 'text-slate-600 border border-slate-200 hover:bg-slate-50">Remove hold</button>'
        : approve + '<button data-del-act="hold" data-name="' + esc(r.name) + '" class="' + btn + 'text-amber-700 bg-amber-50 hover:bg-amber-100"><i class="fa-solid fa-pause mr-1"></i>Hold</button>';

    const checklist = '<div class="mt-3 rounded-md border px-3 py-2 ' + (gaps.length ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60') + '">'
        + (gaps.length
            ? '<div class="text-[11.5px] font-semibold text-amber-800 mb-1">Incomplete OJT record</div><ul class="text-[11.5px] text-amber-800 space-y-0.5">' + gaps.map(g => '<li><i class="fa-solid fa-circle-exclamation mr-1.5 text-[10px]"></i>' + esc(g) + '</li>').join('') + '</ul>'
              + '<a href="' + profileLink(r.name) + '" class="inline-block mt-1.5 text-[11.5px] font-semibold text-sky-700 hover:underline">Open profile to complete →</a>'
            : '<div class="text-[11.5px] font-semibold text-emerald-800"><i class="fa-solid fa-circle-check mr-1.5"></i>OJT record complete. Ready for deletion.</div>')
        + '</div>';
    const held = r.status === 'held' ? '<div class="mt-2 text-[11.5px] text-slate-600 bg-slate-50 rounded-md px-3 py-2"><span class="font-semibold text-slate-700">Hold reason (' + formatDate(r.heldAt) + '):</span> ' + esc(r.holdReason) + '<div class="text-[10.5px] text-slate-400 mt-0.5">The alumni sees this reason.</div></div>' : '';
    const form = holdFormFor === r.name ? '<div class="mt-3"><label class="text-[11.5px] font-medium text-slate-600 block mb-1">Reason for the hold (shown to the alumni)</label>'
        + '<textarea id="holdReasonInput" rows="2" class="w-full border border-slate-300 rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-sky-400">' + esc(gaps.length ? 'Your OJT record is still incomplete: ' + gaps.join('; ') + '.' : '') + '</textarea>'
        + '<div class="flex justify-end gap-2 mt-2"><button data-del-act="hold-cancel" class="text-[12px] font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>'
        + '<button data-del-act="hold-save" data-name="' + esc(r.name) + '" class="text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-md">Save hold</button></div></div>' : '';
    return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">' + head + '<div class="flex gap-2 flex-shrink-0 items-center flex-wrap">' + actions + '</div></div>'
        + checklist + held + form
        + '<p class="text-[11.5px] text-slate-500 mt-3">Profile, resume and job-matching data will be deleted. The OJT record (hours, attendance photos and GPS, approved logs, signed scans) is kept read-only until <strong class="text-slate-700">' + keep + '</strong> (5 years after completion).</p></div>';
}
function renderDeletionRequests(){
    const code = activeClassCode();
    const all = getDeletionRequests().filter(r => r.classCode ? r.classCode === code : code === SEED_CODE);
    const open = all.filter(r => r.status !== 'processed'), processed = all.filter(r => r.status === 'processed');
    document.getElementById('wr-deletions').innerHTML = (open.length ? open.map(deletionCard).join('') : '<p class="text-[12.5px] text-slate-400">No open deletion requests.</p>')
        + (processed.length ? '<div class="pt-3 space-y-2.5"><div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Processed</div>' + processed.map(deletionCard).join('') + '</div>' : '');
    updateRequestCounts();
}
function initCoordinatorDeletions(){
if(!document.getElementById('wr-deletions')) return;
    renderDeletionRequests();
    document.getElementById('wr-deletions').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-del-act]');
        if(!btn || btn.disabled) return;
        const act = btn.dataset.delAct, name = btn.dataset.name;
        if(act === 'hold'){ holdFormFor = name; }
        if(act === 'hold-cancel'){ holdFormFor = ''; }
        if(act === 'hold-save'){
            const reason = document.getElementById('holdReasonInput').value.trim();
            if(!reason){ showToast('Add a reason for the hold.', 'warn'); return; }
            saveDeletionRequest(name, {status: 'held', holdReason: reason, heldAt: todayISO()});
            logAudit('Put the deletion request of ' + name + ' on hold: ' + reason, 'Hold');
            holdFormFor = '';
            showToast('Request of ' + esc(name) + ' is on hold. The alumni will see the reason.', 'warn');
        }
        if(act === 'resume'){ saveDeletionRequest(name, {status: 'pending', holdReason: '', heldAt: ''}); logAudit('Removed the hold on the deletion request of ' + name); }
        if(act === 'approve'){
            const p = placementList().find(x => x.name === name);
            if(!await askConfirm('Delete the profile, resume and job-matching data of ' + name + '?\n\nThe OJT record stays read-only until ' + retainUntil(alumniCompletedAt(p)) + '. This cannot be undone.')) return;
            saveDeletionRequest(name, {status: 'processed', processedAt: todayISO(), completedAt: alumniCompletedAt(p)});
            logAudit('Deleted the profile, resume and job-matching data of ' + name + ' (OJT record kept until ' + retainUntil(alumniCompletedAt(p)) + ')', 'Deleted');
            showToast('Profile data of ' + esc(name) + ' deleted. OJT record kept until ' + retainUntil(alumniCompletedAt(p)) + '.', 'success');
        }
        renderDeletionRequests();
    });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initDeletions = initCoordinatorDeletions;
