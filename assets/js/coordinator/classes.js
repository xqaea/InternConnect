/* ============ Classes Page ============ */

function renderClasses(){
    const box = document.getElementById('classList');
    if(!box) return;
    const showArchived = document.getElementById('showArchived').checked;
    const active = activeClassCode();
    const list = myClasses().filter(c => showArchived || c.status !== 'archived');
    if(!list.length){
        box.innerHTML = '<p class="text-[12.5px] text-slate-400 col-span-full">No batches yet. Create your first batch.</p>';
        return;
    }
    box.innerHTML = list.map(c => {
        const n = classCounts(c.code);
        const isCurrent = c.code === active;
        const btn = 'text-[11.5px] font-semibold px-3 py-1.5 rounded-md transition ';
        return '<div class="bg-white rounded-xl border ' + (isCurrent ? 'border-sky-300' : 'border-slate-200') + ' shadow-sm p-4">'
          + '<div class="flex items-start justify-between gap-2">'
          +   '<div><div class="font-semibold text-slate-900 text-sm">' + esc(c.term) + '</div>'
          +   '<div class="text-[11.5px] text-slate-400 mt-0.5">' + esc(c.program || '') + '</div></div>'
          +   '<div class="flex items-center gap-1.5 flex-shrink-0">'
          +     (isCurrent ? '<span class="text-[10.5px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">Current</span>' : '')
          +     '<span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[c.status] + '">' + capitalize(c.status) + '</span>'
          +   '</div></div>'
          + '<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">'
          +   '<span><i class="fa-solid fa-user-graduate mr-1 text-slate-400"></i>' + n.interns + ' interns</span>'
          +   '<span><i class="fa-solid fa-medal mr-1 text-slate-400"></i>' + n.alumni + ' alumni</span>'
          +   '<span class="text-slate-500"><i class="fa-solid fa-hashtag mr-1 text-slate-400"></i>' + esc(c.code) + '</span>'
          + '</div>'
          + '<div class="mt-3 flex flex-wrap gap-2">'
          +   '<button data-act="open" data-code="' + esc(c.code) + '" class="' + btn + 'text-white bg-slate-900 hover:bg-slate-800">Open roster</button>'
          +   (isCurrent ? '' : '<button data-act="current" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Set as current</button>')
          +   (c.status === 'closed' && n.interns === 0 ? '<button data-act="archive" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Archive</button>' : '')
          +   '<button data-act="rename" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Rename</button>'
          +   (c.code !== SEED_CODE && memberTotal(c.code) === 0 ? '<button data-act="delete" data-code="' + esc(c.code) + '" class="' + btn + 'text-red-600 bg-red-50 hover:bg-red-100">Delete</button>' : '')
          +   (c.status === 'archived' ? '<button data-act="restore" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Restore</button>' : '')
          + '</div></div>';
    }).join('');
}

function initCoordinatorClasses(){
  if(!document.getElementById('classList')) return;
    renderClasses();
    on('showArchived', 'change', renderClasses);

    document.getElementById('classList').addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-act]');
        if(!btn) return;
        const code = btn.dataset.code;
        if(btn.dataset.act === 'open'){ setActiveClass(code); goTo('roster'); return; }
        if(btn.dataset.act === 'current'){ setActiveClass(code); showToast('Current batch changed to ' + code + '.', 'info'); }
        if(btn.dataset.act === 'archive'){ if(!await askConfirm('Archive this batch? Its records are kept.')) return; updateClass(code, {status: 'archived'}); showToast('Batch archived. Its records are kept.', 'info'); }
        if(btn.dataset.act === 'restore'){ updateClass(code, {status: 'closed'}); showToast('Batch restored.', 'info'); }
        if(btn.dataset.act === 'rename'){ openBatchModal(code); return; }
        if(btn.dataset.act === 'delete'){
            if(myClasses().length <= 1) return showToast('You need at least one batch. Create another one first.', 'warn');
            if(!await askConfirm('Delete this empty batch? This cannot be undone.')) return;
            const stored = getJSON('ic_classes', {});
            delete stored[code];
            localStorage.setItem('ic_classes', JSON.stringify(stored));
            showToast('Batch deleted.', 'info');
        }
        refreshHeaderCode();
        renderClasses();
    });

    // Create New Batch
    const batchModal = document.getElementById('batchModal');
    let editingCode = null;   // null = creating a new batch, otherwise the code being renamed
    function openBatchModal(code){
        editingCode = code || null;
        const cls = code ? myClasses().find(c => c.code === code) : null;
        document.getElementById('batchModalTitle').textContent = cls ? 'Rename Batch' : 'Create New Batch';
        document.getElementById('batchModalNote').classList.toggle('hidden', !!cls);
        document.getElementById('createBatchBtn').textContent = cls ? 'Save' : 'Create Batch';
        document.getElementById('batchTermInput').value = cls ? cls.term : '';
        openModal(batchModal);
    }
    window.openBatchModal = openBatchModal;
    on('openBatchModalBtn', 'click', () => openBatchModal());
    on('cancelBatchBtn', 'click', () => closeModal(batchModal));
    on('createBatchBtn', 'click', () => {
        const term = document.getElementById('batchTermInput').value.trim();
        if(!term) return showToast('Enter a batch name first.', 'warn');
        if(editingCode){
            updateClass(editingCode, {term});
            closeModal(batchModal);
            renderClasses();
            return showToast('Batch renamed.', 'success');
        }
        const me = getJSON('ic_session', null) || {};
        const prefix = programShort(me.program) || 'OJT';   // same format as the register code (ex. BSCS-X7K2QP)
        let code;
        do { code = prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); } while(getClasses()[code]);
        const stored = getJSON('ic_classes', {});
        stored[code] = {program: me.program, theme: me.theme, school: me.school, coordinator: me.email, term, status: 'active', createdAt: todayISO()};
        localStorage.setItem('ic_classes', JSON.stringify(stored));
        setActiveClass(code);
        closeModal(batchModal);
        refreshHeaderCode();
        renderClasses();
        showToast('Batch created. Class code: ' + code, 'success');
    });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initClasses = initCoordinatorClasses;

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    window.ICCore?.coordinator?.initClasses?.();
  }, { once: true });
})();
