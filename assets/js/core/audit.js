const AUDIT_KEY = 'ic_audit';
function auditStorageKey(session){
    const identity = String((session || {}).email || (session || {}).name || 'guest').trim().toLowerCase();
    return AUDIT_KEY + ':' + (identity.replace(/[^a-z0-9._-]+/g, '_') || 'guest');
}
function logAudit(action, status, system){
    const sess = getJSON('ic_session', {});
    const d = new Date();
    const key = auditStorageKey(sess), all = getJSON(key, []);
    all.push({at: isoDate(d) + ' ' + d.toTimeString().slice(0, 8), action, status: status || 'Success',
        user: system ? 'system-auto' : (sess.role === 'partnercompany' ? 'partner-' : 'coord-') + (sess.name || 'coordinator').split(/\s+/).map(w => w[0]).join('').toLowerCase() + '-001',
        source: system ? 'system' : 'client'});
    if(window.ICCore?.storage) window.ICCore.storage.setJSON(key, all.slice(-500));
    else localStorage.setItem(key, JSON.stringify(all.slice(-500)));
}

/* ============ Audit Trail ============ */

window.ICCore = window.ICCore || {};
window.ICCore.audit = window.ICCore.audit || {};
window.ICCore.audit.log = logAudit;
