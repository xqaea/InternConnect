/* ============ Alumni Status Requests (shared local prototype storage) ============ */
const ALUMNI_REQUEST_KEY = 'ic_alumni_requests';
function getAlumniRequests(){ return getJSON(ALUMNI_REQUEST_KEY, []); }
function saveAlumniRequests(list){ localStorage.setItem(ALUMNI_REQUEST_KEY, JSON.stringify(list)); }

/* ============ Accounts and Themes (prototype "database" in localStorage) ============ */

// users   = every registered account (role, email, password, program, theme...)
// classes = class code -> { program, theme } (created by the coordinator at sign up)
const getUsers = () => getJSON('ic_users', []);
const saveUsers = (list) => localStorage.setItem('ic_users', JSON.stringify(list));
const getClasses = () => Object.assign({'PHINMA-CS-2026': {program: 'BS Computer Science', theme: 'sky'}}, getJSON('ic_classes', {}));


/* ============ Classes (batches) ============ */

// classes = { code: { program, theme, school, coordinator, term, status: active | closed | archived, createdAt } }
const SEED_CODE = 'PHINMA-CS-2026';   // demo class used by the demo login
const REQUIRED_HOURS = 486;


// Every batch of the logged-in coordinator (newest first)
function myClasses(){
    const me = getJSON('ic_session', null) || {};
    const all = getClasses();
    return Object.keys(all)
        .filter(code => me.databaseAccount && me.role === 'coordinator'
            ? all[code].databaseBatch && all[code].coordinator === me.email
            : all[code].coordinator === me.email || (code === SEED_CODE && me.classCode === SEED_CODE))
        .map(code => Object.assign({term: 'Initial batch', status: 'active', createdAt: '2026-01-01'}, all[code], {code}))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
// The batch the coordinator is working in right now (remembered in the browser)
function activeClassCode(){
    const list = myClasses();
    const me = getJSON('ic_session', null) || {};
    const saved = localStorage.getItem('ic_active_class');
    if(list.some(c => c.code === saved)) return saved;
    if(list.some(c => c.code === me.classCode)) return me.classCode;
    return list.length ? list[0].code : '';
}
function activeClass(){ return myClasses().find(c => c.code === activeClassCode()) || null; }
function setActiveClass(code){ localStorage.setItem('ic_active_class', code); }
function updateClass(code, patch){
    const stored = getJSON('ic_classes', {});
    stored[code] = Object.assign({}, getClasses()[code], patch);
    localStorage.setItem('ic_classes', JSON.stringify(stored));
}
function updateUser(email, role, patch){
    saveUsers(getUsers().map(u => (u.email === email && u.role === role) ? Object.assign({}, u, patch) : u));
}
// Sample (demo) students only exist in the demo batch. Every other batch only has the students who joined it.
const sampleFor = (code) => code === SEED_CODE ? sampleMembers : [];
const studentsOf = (code) => getUsers().filter(u => u.role === 'student' && u.classCode === code && u.status !== 'pending');
// The batch whose data is on screen: the coordinator's current batch, or a student's own batch
function currentBatchCode(){
    const me = getJSON('ic_session', null) || {};
    return me.role === 'coordinator' ? activeClassCode() : (me.classCode || activeClassCode());
}
// Same people as Overview / Roster / Placements: current students vs completed (alumni) of that batch
function classCounts(code){
    const people = placementList(code);
    return {
        interns: people.filter(p => !['Completed', 'Withdrawn'].includes(p.status)).length,
        alumni: people.filter(p => p.status === 'Completed').length
    };
}
function memberTotal(code){
    return getUsers().filter(u => u.classCode === code && u.role !== 'coordinator').length;
}
function refreshHeaderCode(){
    const code = activeClassCode();
    if(code) document.querySelectorAll('[data-user="classcode"]').forEach(el => el.textContent = code);
}
const STATUS_BADGE = {
    active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    closed: 'text-amber-700 bg-amber-50 border-amber-200',
    archived: 'text-slate-500 bg-slate-100 border-slate-200'
};
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
