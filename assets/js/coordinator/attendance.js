function attendanceRow(p){
    const hours = p.hours || 0;
    const pct = Math.min(100, Math.round(hours / REQUIRED_HOURS * 100));
    const risk = internAtRisk(p);
    const mode = scheduleOf(p).mode;
    const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const riskBadge = p.status === 'Hours complete'
        ? '<span class="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Hours complete</span>'
        : !hours ? '<span class="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Just started</span>'
        : risk ? '<span title="' + (expectedHours(p) == null ? '' : 'Behind schedule: ' + hours + ' of ' + expectedHours(p) + ' expected hours') + '" class="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">At-Risk</span>'
        : '<span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">On Track</span>';
    return '<tr' + (risk ? ' class="bg-red-50/40"' : '') + ' data-intern="' + esc(p.name) + '" data-name="' + esc((p.name + ' ' + (p.studentNo || '')).toLowerCase()) + '" data-company="' + esc(p.company) + '" data-status="' + mode + '">'
      + '<td class="px-5 py-3"><div class="flex items-center gap-2.5"><div class="w-7 h-7 rounded-full ' + (risk ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700') + ' text-[11px] font-semibold flex items-center justify-center">' + profilePictureContent(p) + '</div>'
      + '<div><div>' + esc(p.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(p.studentNo || '') + '</div></div></div></td>'
      + '<td class="px-5 py-3 text-[13px] text-slate-600">' + esc(p.company) + '</td>'
      + '<td class="px-5 py-3"><div class="flex items-center gap-2"><div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ' + (risk ? 'bg-red-500' : 'bg-sky-600') + '" style="width:' + pct + '%"></div></div><span class="text-[11.5px] text-slate-500">' + hours + ' / ' + REQUIRED_HOURS + '</span></div></td>'
      + '<td class="px-5 py-3"><span class="text-[11px] font-medium ' + (mode === 'On-site' ? 'text-slate-600 bg-slate-100' : 'text-sky-700 bg-sky-50') + ' px-2 py-0.5 rounded-full">' + mode + '</span></td>'
      + '<td class="px-5 py-3">' + riskBadge + '</td>'
      + '<td class="px-5 py-3 whitespace-nowrap"><div class="flex items-center gap-2"><button class="attendance-log text-[11.5px] font-medium text-sky-600 hover:text-sky-700">View Log</button>'
      + '<span class="w-[66px] flex">' + (pendingFlags(p) ? '<span class="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full" title="Clock-ins outside the geofence to review">' + pendingFlags(p) + ' flagged</span>' : '') + '</span>'
      + '<button class="attendance-files text-[11.5px] font-medium text-slate-500 hover:text-sky-700"><i class="fa-solid fa-folder-open mr-1"></i>Files</button></div></td></tr>';
}
function renderAttendance(){
    const list = placementList().filter(p => ['Deployed', 'Hours complete'].includes(p.status)).sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById('attendanceTbody').innerHTML = list.map(attendanceRow).join('');
    document.getElementById('attendanceNoResults').dataset.empty = list.length ? '' : '1';
    filterAttendance();
}

// Search + Filter
function filterAttendance(){
    const q = (document.getElementById('studentSearch').value || '').toLowerCase().trim();
    const company = document.getElementById('companyFilter').value;
    const status = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#attendanceTbody tr');
    let visibleCount = 0;
    rows.forEach(row => {
      const name = row.dataset.name || '';
      const rowCompany = row.dataset.company || '';
      const rowStatus = row.dataset.status || '';
      const matchesQuery = !q || name.includes(q);
      const matchesCompany = !company || rowCompany === company;
      const matchesStatus = !status || rowStatus === status;
      const show = matchesQuery && matchesCompany && matchesStatus;
      row.classList.toggle('hidden', !show);
      if(show) visibleCount++;
    });
    const none = document.getElementById('attendanceNoResults');
    const empty = !!none.dataset.empty;   // nobody is deployed in this batch yet (not just filtered out)
    none.querySelector('.font-semibold').textContent = empty ? 'No deployed interns yet' : 'No students found';
    none.querySelector('p').textContent = empty ? 'Interns show up here after you deploy them on the Placements page.' : 'Try adjusting your search or filters.';
    none.classList.toggle('hidden', visibleCount !== 0);
}
on('studentSearch', 'input', filterAttendance);
on('companyFilter', 'change', filterAttendance);
on('statusFilter', 'change', filterAttendance);
function initCoordinatorAttendanceTable(){
if(!document.getElementById('attendanceTbody')) return;
    document.getElementById('companyFilter').insertAdjacentHTML('beforeend', partnerNames().map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join(''));
    const chip = document.getElementById('attProgram');
    if(chip) chip.textContent = 'Program: ' + (programShort((getJSON('ic_session', null) || {}).program || '') || 'All');
    renderAttendance();
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initAttendanceTable = initCoordinatorAttendanceTable;



// View Log opens the Intern profile, Files opens the intern's folder in their partner's vault
function initCoordinatorAttendanceLinks(){
document.getElementById('attendanceTbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.attendance-files, .attendance-log');
    if(!btn) return;
    const row = btn.closest('tr');
    const name = row.dataset.intern;
    if(btn.classList.contains('attendance-log')) window.location.href = profileLink(name) + '#attendance';
    else openInternFiles(row.dataset.company, name);
});
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initAttendanceLinks = initCoordinatorAttendanceLinks;

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initAttendanceExport?.();
    window.ICCore?.coordinator?.initAttendanceLinks?.();
    window.ICCore?.coordinator?.initAttendanceTable?.();
  }, { once: true });
})();
