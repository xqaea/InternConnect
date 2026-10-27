const AUDIT_BADGE = {Success: 'text-emerald-700 bg-emerald-50', Verified: 'text-emerald-700 bg-emerald-50', Flagged: 'text-amber-600 bg-amber-50', Hold: 'text-amber-600 bg-amber-50', Deleted: 'text-slate-600 bg-slate-100', Anonymized: 'text-slate-600 bg-slate-100'};
// Audit rows come only from actions recorded by logAudit. There are no demo rows.
const auditRows = () => getJSON(auditStorageKey(getJSON('ic_session', {})), []).slice().reverse();
function renderAudit(){
    const rows = auditRows();
    document.getElementById('auditTbody').innerHTML = rows.length ? rows.map(a => '<tr>'
        + '<td class="px-5 py-3 text-slate-500 font-mono text-[11.5px] whitespace-nowrap">' + esc(a.at) + '</td><td class="px-5 py-3 text-slate-600">' + esc(a.user) + '</td>'
        + '<td class="px-5 py-3 text-slate-700">' + esc(a.action) + '</td>'
        + '<td class="px-5 py-3"><span class="text-[11px] font-medium px-2 py-0.5 rounded-full ' + (AUDIT_BADGE[a.status] || AUDIT_BADGE.Success) + '">' + esc(a.status) + '</span></td></tr>').join('')
        : '<tr><td colspan="4" class="px-5 py-8 text-center text-[12.5px] text-slate-400">No activity logged yet.</td></tr>';
}
window.ICCore.audit.render = renderAudit;
window.ICCore.audit.rows = auditRows;

/* Coordinator Audit Trail page wiring. Feature logic remains exposed through ICCore.audit. */
(function () {
  'use strict';
  if (!document.getElementById('auditTbody') || !window.ICCore?.audit) return;
  const audit = window.ICCore.audit;
  getDeletionRequests();
  audit.render();
  const btn = document.getElementById('exportAuditBtn');
  const menu = document.getElementById('exportAuditMenu');
  if (!btn || !menu) return;
  const setMenu = (open) => { menu.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.classList.contains('hidden')); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-export]');
    if (!item) return;
    setMenu(false);
    const label = item.dataset.export === 'xlsx' ? 'Excel' : 'PDF';
    try { if (!(item.dataset.export === 'xlsx' ? audit.exportXlsx() : audit.exportPdf())) return; }
    catch (err) { console.error(err); showToast('Could not create the file. Please try again.', 'warn'); return; }
    audit.log('Exported the audit trail log (' + label + ')');
    audit.render();
    showToast('Audit log downloaded as ' + label + '.', 'success');
  });
})();
