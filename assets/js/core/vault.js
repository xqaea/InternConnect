/* ============ Vault data (pages below use it) ============ */

// Shared vault per partner company (prototype storage: ic_vault)
// { company: { folders: [{id, name, parent, system, intern}], files: [{id, name, folder, type, owner, uploadedAt, version, pending}] } }
// Letters are made and signed outside the system; the vault only keeps and shares the signed scans.
const VAULT_KEY = 'ic_vault';
function readPrototypeFile(file){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
function downloadPrototypeFile(file){
    if(!file?.data){ showToast('This older record saved the file name only. Upload the file again to download it.', 'warn'); return; }
    const a = document.createElement('a'); a.href = file.data; a.download = file.name || 'Document'; a.click();
}
const VAULT_TYPES = ['MOA / MOU', 'Endorsement letter', 'Acceptance letter', 'Supervisor evaluation', 'DTR / attendance', 'Company document', 'Other'];
// Sample partner companies only exist in the demo batch. Other batches only have the partners the coordinator added or approved.
const PARTNER_COMPANIES = ['Brightpath Software', 'Verano Digital Studio', 'Nova Retail Systems', 'Cavite Provincial IT Office'];
const DEMO_PARTNERS = PARTNER_COMPANIES.map(name => ({name}));
// Partners without an account are added by the coordinator (ic_partners); approved partner sign ups join the list automatically
const PARTNERS_KEY = 'ic_partners';
const PARTNER_SEED = {
    'Brightpath Software': {industry: 'Software Development', hr: 'Ms. Sarah Geronimo', moaUntil: '2027-12-31'},
    'Verano Digital Studio': {industry: 'Web & Creative Services', hr: 'Mr. Paulo Ramirez', moaUntil: '2026-11-30'},
    'Nova Retail Systems': {industry: 'Retail Technology', hr: 'Ms. Donna Villar', moaUntil: '2028-06-30'},
    'Cavite Provincial IT Office': {industry: 'Government / Public Sector', hr: 'Engr. Bautista', moaUntil: '2027-01-31'}
};
// Who is using the vault: the coordinator, or the partner's HR through the partner portal
const VAULT_ME = (getJSON('ic_session', {}) || {}).role === 'partnercompany' ? 'hr' : 'coordinator';
function partnerAccounts(company, code){
    const c = (company || '').toLowerCase();
    code = code || currentBatchCode();
    return getUsers().filter(u => u.role === 'partnercompany' && u.status === 'active' && u.company && u.classCode === code && (!c || u.company.toLowerCase() === c));
}
function partnerCompanies(code){
    code = code || currentBatchCode();
    const saved = getJSON(PARTNERS_KEY, {});
    const names = (code === SEED_CODE ? PARTNER_COMPANIES.slice() : []).concat(Object.keys(saved).filter(n => (saved[n].classCode || SEED_CODE) === code));
    partnerAccounts('', code).forEach(u => { if(!names.some(n => n.toLowerCase() === u.company.toLowerCase())) names.push(u.company); });
    return [...new Set(names)];
}
const partnerNames = (code) => partnerCompanies(code);
function partnerInfo(name){
    const acc = partnerAccounts(name), saved = getJSON(PARTNERS_KEY, {})[name] || {};
    return Object.assign({name, industry: '', hr: acc[0] ? acc[0].name : '', moaUntil: ''}, PARTNER_SEED[name] || {}, saved, {accounts: acc, removable: !!saved.addedBy && !acc.length});
}
function moaStatus(until){
    if(!until) return ['No MOA date', 'text-slate-500 bg-slate-50 border-slate-200'];
    const days = (new Date(until) - new Date(todayISO())) / 864e5;
    return days < 0 ? ['Expired', 'text-red-600 bg-red-50 border-red-200'] : days <= 90 ? ['Expiring Soon', 'text-amber-600 bg-amber-50 border-amber-200'] : ['Active', 'text-emerald-700 bg-emerald-50 border-emerald-200'];
}

const getVaults = () => getJSON(VAULT_KEY, {});
const saveVaults = (all) => localStorage.setItem(VAULT_KEY, JSON.stringify(all));
const vaultId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);


/* ============ Partner and MOA Directory ============ */


// Opens the intern's folder in their partner's vault (used by the Roster and Attendance pages)
function openInternFiles(company, intern){
    if(!company || company === '—'){ showToast(intern + ' has no partner company yet.', 'warn'); return; }
    window.location.href = pages.partners + '?vault=' + encodeURIComponent(company) + '&intern=' + encodeURIComponent(intern);
}

// Interns deployed to a company (real students + sample roster)
function internsOf(company){
    const code = currentBatchCode();
    const real = studentsOf(code).filter(u => u.company === company).map(u => u.name);
    const sample = sampleFor(code).filter(m => m.company === company).map(m => m.name);
    const placed = placementList().filter(p => p.company === company && p.status !== 'Not placed').map(p => p.name);
    return [...new Set(real.concat(sample, placed))];
}

// Creates the default folders the first time, and one folder per intern deployed to the company
function ensureVault(company){
    const all = getVaults();
    let v = all[company];
    if(!v){
        v = {folders: [
            {id: 'agreements', name: 'Agreements (MOA / MOU)', parent: null, system: true},
            {id: 'company', name: 'Company documents', parent: null, system: true},
            {id: 'interns', name: 'Interns', parent: null, system: true}
        ], files: DEMO_PARTNERS.some(d => d.name === company) ? [
            {id: vaultId(), name: 'MOA_' + fileSlug(company) + '_2026.pdf', folder: 'agreements', type: 'MOA / MOU', owner: 'hr', uploadedAt: '2026-06-02', version: 1},
            {id: vaultId(), name: 'Company_Profile.pdf', folder: 'company', type: 'Company document', owner: 'coordinator', uploadedAt: '2026-06-05', version: 1}
        ] : []};
        all[company] = v;
    }
    internsOf(company).forEach(name => {
        if(v.folders.some(f => f.intern === name)) return;
        const id = 'intern-' + vaultId();
        v.folders.push({id, name, parent: 'interns', system: true, intern: name});
        if(sampleMembers.some(m => m.name === name && m.company === company)){
            const slug = fileSlug(name);
            v.files.push({id: vaultId(), name: 'Endorsement_Letter_' + slug + '.pdf', folder: id, type: 'Endorsement letter', owner: 'coordinator', uploadedAt: '2026-06-10', version: 1});
            v.files.push({id: vaultId(), name: 'Acceptance_Letter_' + slug + '.pdf', folder: id, type: 'Acceptance letter', owner: 'hr', uploadedAt: '2026-06-14', version: 1});
            if(sampleMembers.some(m => m.name === name && m.status === 'alumni'))
                v.files.push({id: vaultId(), name: 'Supervisor_Evaluation_' + slug + '.pdf', folder: id, type: 'Supervisor evaluation', owner: 'hr', uploadedAt: '2026-03-10', version: 1},
                             {id: vaultId(), name: 'DTR_' + slug + '.pdf', folder: id, type: 'DTR / attendance', owner: 'coordinator', uploadedAt: '2026-03-12', version: 1});
        }
        const seed = PLACEMENT_SEED[name];
        if(seed && seed.company === company) (seed.docs || []).forEach(type => {
            v.files.push({id: vaultId(), name: type.replace(/ /g, '_').replace(/^./, c => c.toUpperCase()).replace('_letter', '_Letter') + '_' + fileSlug(name) + '.pdf', folder: id, type,
                owner: type === 'Acceptance letter' ? 'hr' : 'coordinator', uploadedAt: '2026-06-0' + (type === 'Acceptance letter' ? '9' : '6'), version: 1});
        });
    });
    saveVaults(all);
    return v;
}
function updateVault(company, change){
    const all = getVaults();
    change(all[company]);
    saveVaults(all);
}

function folderById(v, id){ return v.folders.find(f => f.id === id) || null; }
function folderPath(v, id){
    const path = [];
    let f = folderById(v, id);
    while(f){ path.unshift(f); f = folderById(v, f.parent); }
    return path;
}
const folderLabel = (v, id) => folderPath(v, id).map(f => f.name).join(' › ');
function internOfFolder(v, id){
    const hit = folderPath(v, id).find(f => f.intern);
    return hit ? hit.intern : '';
}
function subfolderIds(v, id){
    return v.folders.filter(f => f.parent === id).reduce((ids, f) => ids.concat(f.id, subfolderIds(v, f.id)), []);
}
function filesUnder(v, id){
    const ids = [id].concat(subfolderIds(v, id));
    return v.files.filter(f => ids.includes(f.folder)).length;
}
function defaultTypeFor(v, folderId){
    if(folderId === 'agreements') return 'MOA / MOU';
    if(folderId === 'company') return 'Company document';
    return internOfFolder(v, folderId) ? 'Endorsement letter' : 'Other';
}
