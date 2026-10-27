/* ============ Placements data (application → endorsement → acceptance → deployment) ============ */

// One status per student, shared by Placements, the Intern profile, the Roster and the vault.
// Letters are made and signed outside the system; a step only moves forward once its signed scan is in the intern's vault folder.
const PLACEMENT_KEY = 'ic_placements';
const PLACEMENT_STEPS = ['Not placed', 'Applied', 'Endorsed', 'Accepted', 'Deployed', 'Hours complete', 'Completed'];
const PLACEMENT_BADGE = {
    'Not placed': 'text-slate-600 bg-slate-100 border-slate-200',
    'Applied': 'text-indigo-700 bg-indigo-50 border-indigo-200',
    'Endorsed': 'text-sky-700 bg-sky-50 border-sky-200',
    'Accepted': 'text-teal-700 bg-teal-50 border-teal-200',
    'Deployed': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Hours complete': 'text-amber-700 bg-amber-50 border-amber-200',
    'Completed': 'text-violet-700 bg-violet-50 border-violet-200',
    'Withdrawn': 'text-red-600 bg-red-50 border-red-200'
};
// Sample students who are not deployed yet (deployed ones come from the roster)
const PLACEMENT_SEED = {
    'Bea R.': {status: 'Not placed', company: '', studentNo: '2023-0190', history: []},
    'Carlo M.': {status: 'Applied', company: 'Cavite Provincial IT Office', studentNo: '2023-0103', history: [{status: 'Applied', date: '2026-06-03', note: 'Cavite Provincial IT Office'}]},
    'Ella S.': {status: 'Endorsed', company: 'Verano Digital Studio', studentNo: '2023-0127', docs: ['Endorsement letter'],
        history: [{status: 'Applied', date: '2026-06-01', note: 'Verano Digital Studio'}, {status: 'Endorsed', date: '2026-06-08'}]},
    'Nico F.': {status: 'Accepted', company: 'Nova Retail Systems', studentNo: '2023-0164', docs: ['Endorsement letter', 'Acceptance letter'],
        history: [{status: 'Applied', date: '2026-05-28', note: 'Nova Retail Systems'}, {status: 'Endorsed', date: '2026-06-04'}, {status: 'Accepted', date: '2026-06-12'}]}
};
const SAMPLE_STUDENT_NO = {'Aiyu T.': '2023-0141', 'Kaye P.': '2023-0056', 'Leo A.': '2023-0088', 'Jomari D.': '2023-0172'};
const getPlacementStore = () => getJSON(PLACEMENT_KEY, {});
function savePlacement(name, patch){
    const all = getPlacementStore();
    all[name] = Object.assign({}, PLACEMENT_SEED[name] || {}, all[name] || {}, patch);
    localStorage.setItem(PLACEMENT_KEY, JSON.stringify(all));
}
const profileLink = (name) => pages.intern + '?name=' + encodeURIComponent(name);
const placementBadge = (status) => '<span class="text-[11px] font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ' + (PLACEMENT_BADGE[status] || PLACEMENT_BADGE['Not placed']) + '">' + status + '</span>';

// Sample history for roster students that were placed before this screen existed
function rosterHistory(m){
    const h = [];
    if(m.company && !m.real){
        const old = m.status === 'alumni';
        h.push({status: 'Applied', date: old ? '2025-10-06' : '2026-05-20', note: m.company}, {status: 'Endorsed', date: old ? '2025-10-13' : '2026-05-27'},
               {status: 'Accepted', date: old ? '2025-10-20' : '2026-06-03'}, {status: 'Deployed', date: old ? '2025-11-03' : '2026-06-15'});
        if(m.hours >= REQUIRED_HOURS) h.push({status: 'Hours complete', date: m.completedAt || '2026-09-30'});
    }
    if(m.status === 'alumni') h.push({status: 'Completed', date: m.completedAt || todayISO()});
    if(m.status === 'withdrawn') h.push({status: 'Withdrawn', date: m.withdrawnAt || todayISO()});
    return h;
}

// Every student with their placement status
function placementList(code){
    code = code || currentBatchCode();
    const store = getPlacementStore();
    const out = {};
    if(code === SEED_CODE) Object.keys(PLACEMENT_SEED).forEach(n => { out[n] = Object.assign({name: n}, PLACEMENT_SEED[n], store[n] || {}); });
    const roster = sampleFor(code).map(m => Object.assign({}, m))
        .concat(studentsOf(code).map(u => ({
            real: true, email: u.email, name: u.name, company: u.company || '', hours: u.ojtHours || u.hours || 0,
            status: u.status === 'alumni_pending' ? 'intern' : (u.status || 'intern'), completedAt: u.completedAt, withdrawnAt: u.withdrawnAt})));
    roster.forEach(m => {
        if(out[m.name]) return;
        const company = m.company === '—' ? '' : m.company;
        const status = m.status === 'alumni' ? 'Completed' : m.status === 'withdrawn' ? 'Withdrawn'
            : !company ? 'Not placed' : m.hours >= REQUIRED_HOURS ? 'Hours complete' : 'Deployed';
        out[m.name] = Object.assign({name: m.name, company, hours: m.hours, status, roster: true, real: m.real, email: m.email,
            studentNo: SAMPLE_STUDENT_NO[m.name] || '', history: rosterHistory(Object.assign({}, m, {company}))}, store[m.name] || {});
    });
    return Object.values(out).filter(p => !isAnonymized(p.name)).map(p => {
        if(!p.company || !['Deployed', 'Hours complete', 'Completed'].includes(p.status)) return p;
        const rawHours = (p.hours || 0) + liveHours(p.name), rejected = rejectedHours(Object.assign({}, p, {rawHours}));
        const hours = Math.max(0, rawHours - rejected);
        return Object.assign(p, {rawHours, hours, status: p.status === 'Hours complete' && hours < REQUIRED_HOURS ? 'Deployed' : p.status});
    });
}

// Signed scans in the intern's vault folder
function internDocs(company, name){
    if(!company) return [];
    const v = ensureVault(company);
    const folder = v.folders.find(f => f.intern === name);
    if(!folder) return [];
    const ids = [folder.id].concat(subfolderIds(v, folder.id));
    return v.files.filter(f => ids.includes(f.folder));
}
const hasDoc = (company, name, type) => internDocs(company, name).some(f => f.type === type);


/* ============ Batch Roster ============ */

// Sample rows so the design can be reviewed (real students of the batch are added on top)
const sampleMembers = [
    {id: 's1', name: 'Aiyu T.', company: 'Brightpath Software', hours: 486, status: 'intern'},
    {id: 's2', name: 'Kaye P.', company: 'Brightpath Software', hours: 420, status: 'intern'},
    {id: 's3', name: 'Leo A.', company: 'Nova Retail Systems', hours: 318, status: 'intern'},
    {id: 's4', name: 'Jomari D.', company: 'Verano Digital Studio', hours: 150, status: 'intern'},
    {id: 's5', name: 'Mara L.', company: 'Brightpath Software', hours: 486, status: 'alumni', completedAt: '2026-03-14', employment: 'employed'},
    {id: 's6', name: 'Rico S.', company: 'Nova Retail Systems', hours: 486, status: 'alumni', completedAt: '2026-03-14', employment: 'seeking'},
    {id: 's7', name: 'Dana V.', company: '—', hours: 72, status: 'withdrawn', withdrawnAt: '2026-02-20'}
];
