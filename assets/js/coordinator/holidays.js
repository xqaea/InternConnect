// Holidays and no-work days: pick a Philippine holiday or type one in (suspensions, company events)
function holidayModal(){
    let m = document.getElementById('holidayModal');
    const field = 'border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="holidayModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 class="font-bold text-slate-900">Holidays &amp; no-work days</h3><button data-hol="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p class="text-[12px] text-slate-500 mb-4">Interns are not marked absent on these days. Applies to the whole batch.</p>'
          + '<div id="holList" class="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg mb-4"></div>'
          + '<div class="text-[12.5px] font-medium text-slate-600 mb-1">Add a day</div>'
          + '<select id="holPreset" class="' + field + ' w-full mb-2"></select>'
          + '<div class="grid grid-cols-[140px_1fr] gap-2 mb-2"><input id="holDate" type="date" class="' + field + '"><input id="holName" type="text" placeholder="Name (e.g. Class suspension, Company anniversary)" class="' + field + '"></div>'
          + '<div class="flex items-center gap-2"><select id="holType" class="' + field + ' flex-1"><option>Regular holiday</option><option>Special non-working day</option><option>Class / work suspension</option><option>Company no-work day</option></select>'
          + '<button data-hol="add" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">Add</button></div>'
          + '<p class="text-[11px] text-slate-400 mt-2">Check the official proclamation for moved or added holidays (e.g. Eid\'l Fitr, Eid\'l Adha) and add them manually.</p></div></div>');
        m = document.getElementById('holidayModal');
        m.addEventListener('change', (e) => {
            if(e.target.id !== 'holPreset' || !e.target.value) return;
            const h = PH_HOLIDAYS_2026.find(x => x[0] === e.target.value);
            document.getElementById('holDate').value = h[0]; document.getElementById('holName').value = h[1]; document.getElementById('holType').value = h[2];
        });
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-hol]');
            if(!b) return;
            if(b.dataset.hol === 'close'){ closeModal(m); return; }
            const list = getHolidays();
            if(b.dataset.hol === 'del'){
                const h = list.find(x => x.date === b.dataset.date);
                saveHolidays(list.filter(x => x.date !== b.dataset.date));
                logAudit('Removed ' + h.name + ' (' + h.date + ') from the holidays of the batch');
            }
            if(b.dataset.hol === 'add'){
                const date = document.getElementById('holDate').value, name = document.getElementById('holName').value.trim(), type = document.getElementById('holType').value;
                if(!date || !name){ showToast('Pick a date and add a name.', 'warn'); return; }
                if(list.some(x => x.date === date)){ showToast(formatDate(date) + ' is already in the list.', 'warn'); return; }
                saveHolidays(list.concat({date, name, type}));
                logAudit('Added ' + name + ' (' + date + ', ' + type.toLowerCase() + ') to the holidays of the batch');
                document.getElementById('holDate').value = ''; document.getElementById('holName').value = '';
            }
            fillHolidayModal();
            renderAttendance();
        });
    }
    fillHolidayModal();
    openModal(m);
}
function fillHolidayModal(){
    const list = getHolidays();
    document.getElementById('holList').innerHTML = list.length ? list.map(h => '<div class="flex items-center justify-between gap-3 px-3 py-2">'
        + '<div><div class="text-[12.5px] font-medium text-slate-800">' + esc(h.name) + '</div><div class="text-[11px] text-slate-400">' + formatDate(h.date) + ' · ' + new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'short'}) + ' · ' + esc(h.type) + '</div></div>'
        + '<button data-hol="del" data-date="' + h.date + '" class="text-slate-400 hover:text-red-600 text-[12px]" title="Remove"><i class="fa-solid fa-trash-can"></i></button></div>').join('')
        : '<div class="px-3 py-4 text-center text-[12px] text-slate-400">No holidays yet.</div>';
    document.getElementById('holPreset').innerHTML = '<option value="">Pick a Philippine holiday (2026)…</option>'
        + PH_HOLIDAYS_2026.filter(h => !list.some(x => x.date === h[0])).map(h => '<option value="' + h[0] + '">' + formatDate(h[0]) + ' · ' + esc(h[1]) + ' (' + h[2] + ')</option>').join('');
    document.getElementById('holidaysCount').textContent = '(' + list.length + ')';
}
function initCoordinatorHolidays(){
    if(!document.getElementById('holidaysBtn')) return;
    document.getElementById('holidaysCount').textContent = '(' + getHolidays().length + ')';
    on('holidaysBtn', 'click', holidayModal);
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initHolidays = initCoordinatorHolidays;

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initHolidays?.();
  }, { once: true });
})();
