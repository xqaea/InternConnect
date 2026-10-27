const CHECKLIST_KEY = 'ic_checklist';
const REQUIREMENTS = [
    ['Endorsement letter', 'Needed before endorsement'],
    ['Acceptance letter', 'Needed before deployment'],
    ['DTR / attendance', 'During the OJT'],
    ['Supervisor evaluation', 'At the end of the OJT']
];

// Records whose 5-year retention ended are anonymized; only a hash is kept so they stay hidden
const ANON_KEY = 'ic_anonymized';
const nameHash = (name) => { let h = 5381; for(const c of name) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const isAnonymized = (name) => getJSON(ANON_KEY, []).includes(nameHash(name));
const plusYears = (iso, n) => iso.replace(/^\d{4}/, y => String(Number(y) + n));

const DELETION_KEY = 'ic_deletion_requests';

/* ============ Alumni Deletion Requests ============ */

// Approve deletes profile, resume and job-matching data; the OJT record stays (read-only) for 5 years after completion.
// Hold is for alumni whose OJT record is still incomplete. Prototype storage: ic_deletion_requests
// [{name, requestedAt, status: pending|held|processed, holdReason, heldAt, processedAt}]
function getDeletionRequests(){
    if(!localStorage.getItem(DELETION_KEY)){
        const checks = getJSON(CHECKLIST_KEY, {});
        REQUIREMENTS.forEach(([type]) => { checks['Mara L.|' + type] = checks['Mara L.|' + type] || '2026-03-14'; });
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checks));
        localStorage.setItem(DELETION_KEY, JSON.stringify([
            {name: 'Mara L.', requestedAt: '2026-10-05', status: 'pending'},
            {name: 'Rico S.', requestedAt: '2026-10-06', status: 'pending'},
            {name: 'Paolo G.', completedAt: '2021-03-12', requestedAt: '2021-04-02', status: 'processed', processedAt: '2021-04-05'}
        ]));
    }
    // When the retention period ends, the kept OJT record is anonymized (name and personal details removed)
    const list = getJSON(DELETION_KEY, []);
    let changed = false;
    list.forEach(r => {
        if(r.status !== 'processed' || !r.completedAt) return;
        if(plusYears(r.completedAt, 5) > todayISO()) return;
        logAudit('Anonymized an OJT record (completed ' + r.completedAt + ') after the 5-year retention period', 'Anonymized', true);
        Object.assign(r, {status: 'anonymized', anonymizedAt: todayISO(), hash: nameHash(r.name), name: 'Anonymized record ' + (list.indexOf(r) + 1)});
        changed = true;
    });
    const anon = getJSON(ANON_KEY, []);
    list.filter(r => r.status === 'anonymized' && r.hash && !anon.includes(r.hash)).forEach(r => anon.push(r.hash));
    placementList().filter(p => p.status === 'Completed' && plusYears(alumniCompletedAt(p), 5) <= todayISO()).forEach(p => {
        const done = alumniCompletedAt(p);
        anon.push(nameHash(p.name));
        list.push({name: 'Anonymized record ' + (list.length + 1), completedAt: done, status: 'anonymized', anonymizedAt: todayISO(), auto: true});
        logAudit('Anonymized an OJT record (completed ' + done + ') after the 5-year retention period', 'Anonymized', true);
        changed = true;
    });
    localStorage.setItem(ANON_KEY, JSON.stringify(anon));
    if(changed) localStorage.setItem(DELETION_KEY, JSON.stringify(list));
    return list;
}
function saveDeletionRequest(name, patch){
    localStorage.setItem(DELETION_KEY, JSON.stringify(getDeletionRequests().map(r => r.name === name ? Object.assign({}, r, patch) : r)));
}
function alumniCompletedAt(p){ return ((p.history || []).filter(h => h.status === 'Completed').pop() || {date: todayISO()}).date; }

// What still has to be done before the OJT record can be archived
function recordGaps(p){
    const checks = getJSON(CHECKLIST_KEY, {});
    const docs = internDocs(p.company, p.name);
    const gaps = [];
    REQUIREMENTS.forEach(([type]) => {
        if(!docs.some(f => f.type === type)) gaps.push('Missing ' + type.toLowerCase());
        else if(!checks[p.name + '|' + type]) gaps.push(type + ' not verified');
    });
    if((p.hours || 0) < REQUIRED_HOURS) gaps.push('Hours incomplete (' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + ')');
    if(pendingFlags(p)) gaps.push(pendingFlags(p) + ' flagged clock-in(s) not reviewed');
    return gaps;
}
