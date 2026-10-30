const AUDIT_BADGE = {Success: 'text-emerald-700 bg-emerald-50', Verified: 'text-emerald-700 bg-emerald-50', Flagged: 'text-amber-600 bg-amber-50', Hold: 'text-amber-600 bg-amber-50', Deleted: 'text-slate-600 bg-slate-100', Anonymized: 'text-slate-600 bg-slate-100'};
// Audit rows come only from actions recorded by logAudit. There are no demo rows.
let serverAuditRows = [], serverAuditState = 'loading';
const databaseAudit = () => !!getJSON('ic_session', {}).databaseAccount;
const auditRows = () => databaseAudit() ? serverAuditRows : getJSON(auditStorageKey(getJSON('ic_session', {})), []).slice().reverse();
function renderAudit(){
    if(databaseAudit() && serverAuditState !== 'ready'){
        document.getElementById('auditTbody').innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-[12.5px] text-slate-400">'+(serverAuditState === 'loading' ? 'Loading activity…' : 'Activity is unavailable. Refresh to try again.')+'</td></tr>';
        return;
    }
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
  if (!btn) return;
  if(databaseAudit()){
    btn.disabled = true;
    const load = async () => {
      serverAuditRows = [];
      serverAuditState = 'loading';
      audit.render();
      try {
        const result = await window.ICCoordinatorApi.audit(activeClassCode());
        serverAuditRows = result.entries;
        serverAuditState = 'ready';
        btn.disabled = false;
      } catch(error) {
        serverAuditState = 'unavailable';
        btn.disabled = true;
      }
      audit.render();
    };
    document.addEventListener('ic:coordinator-ready', load, {once:true});
  }
  btn.addEventListener('click', () => {
    const label = 'PDF';
    try { if (!audit.exportPdf()) return; }
    catch (err) { console.error(err); showToast('Could not create the file. Please try again.', 'warn'); return; }
    if(!databaseAudit()) audit.log('Exported the audit trail log (' + label + ')');
    audit.render();
    showToast('Audit log downloaded as ' + label + '.', 'success');
  });
})();
