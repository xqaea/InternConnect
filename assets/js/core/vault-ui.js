const vaultModal = document.getElementById('vaultModal');
let vaultCompany = '';
let vaultFolder = null;       // null = vault root
let replaceTargetId = null;
let sharedVaultLoading=false,sharedVaultUnavailable=false;

const VAULT_BTN = 'text-[10.5px] font-semibold px-2 py-1 rounded-md transition ';
function vaultFolderRow(v, f){
    const count = filesUnder(v, f.id);
    return '<div class="flex items-center justify-between gap-2 border border-slate-200 rounded-md px-3 py-2.5 hover:border-sky-300 transition">'
      + '<button data-open-folder="' + esc(f.id) + '" class="flex items-center gap-2.5 min-w-0 flex-1 text-left">'
      +   '<i class="fa-solid ' + (f.intern ? 'fa-folder-closed' : 'fa-folder') + ' text-amber-400 flex-shrink-0"></i>'
      +   '<div class="min-w-0"><div class="text-[12.5px] font-medium text-slate-700 truncate">' + (f.intern ? '<i class="fa-solid fa-user text-[10px] text-slate-400 mr-1"></i>' : '') + esc(f.name) + '</div>'
      +   '<div class="text-[10.5px] text-slate-400">' + count + ' file' + (count === 1 ? '' : 's') + (f.system ? '' : (f.owner || 'coordinator') === VAULT_ME ? ' · your folder' : VAULT_ME === 'hr' ? ' · coordinator folder' : ' · partner folder') + '</div></div></button>'
      + (f.system || (f.owner || 'coordinator') !== VAULT_ME ? '<i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>'
          : '<div class="flex gap-2 flex-shrink-0">'
          +   '<button data-folder-act="rename" data-id="' + esc(f.id) + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-pen mr-1"></i>Rename</button>'
          +   '<button data-folder-act="delete" data-id="' + esc(f.id) + '" class="' + VAULT_BTN + 'text-red-600 bg-red-50 hover:bg-red-100"><i class="fa-solid fa-trash mr-1"></i>Delete</button></div>')
      + '</div>';
}
function vaultFileRow(v, f, showPath){
    const owns = f.sharedLetter?f.canEdit:f.owner === VAULT_ME, mine = owns || (!f.sharedLetter && f.unlocked === VAULT_ME), asker = f.pendingBy || 'coordinator';
    const icon = /\.(jpe?g|png)$/i.test(f.name) ? 'fa-file-image text-sky-500' : 'fa-file-pdf text-red-500';
    const meta = [esc(f.type), owns ? 'Uploaded by you' : VAULT_ME === 'hr' ? 'Uploaded by coordinator' : 'Uploaded by partner HR', formatDate(f.uploadedAt), 'v' + f.version];
    const ofIntern = internOfFolder(v, f.folder);
    if(ofIntern && getJSON('ic_checklist', {})[ofIntern + '|' + f.type]) meta.push('<span class="text-emerald-700 font-medium">Verified by coordinator</span>');
    if(showPath) meta.unshift('<i class="fa-solid fa-folder text-amber-400 mr-0.5"></i>' + esc(folderLabel(v, f.folder)));
    const pending = f.pending ? ' <span class="ml-1 text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">' + (owns && asker !== VAULT_ME ? (asker === 'hr' ? 'Partner' : 'Coordinator') + ' asks to ' + f.pending : (f.pending === 'delete' ? 'Delete' : 'Edit') + ' request pending') + '</span>' : '';
    let actions = f.pending
      ? (owns && asker !== VAULT_ME ? '<button data-file-act="approve-req" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100"><i class="fa-solid fa-check mr-1"></i>Approve</button>'
        + '<button data-file-act="decline-req" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-slate-600 bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-xmark mr-1"></i>Decline</button>' : '')
      : mine
      ? '<button data-file-act="rename" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-pen mr-1"></i>Rename</button>'
      + '<button data-file-act="replace" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-arrow-up-from-bracket mr-1"></i>Replace</button>'
      + (owns ? '<button data-file-act="delete" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-red-600 bg-red-50 hover:bg-red-100"><i class="fa-solid fa-trash mr-1"></i>Delete</button>' : '')
      : '<button data-file-act="request-edit" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-slate-500 bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-lock mr-1"></i>Request edit</button>'
      + '<button data-file-act="request-delete" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-slate-500 bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-lock mr-1"></i>Request delete</button>';
    if(f.sharedLetter && !f.canEdit)actions='<span class="text-[10.5px] text-slate-400">View only</span>';
    if(!f.sharedLetter && owns && f.data && window.ICSharedLetters?.enabled() && window.ICSharedLetters.kind(f.type))actions+='<button data-file-act="share" data-id="'+esc(f.id)+'" class="'+VAULT_BTN+'text-sky-700 bg-sky-50">Share letter</button>';
    return '<div class="flex flex-wrap items-center justify-between gap-2 border border-slate-200 rounded-md px-3 py-2.5">'
      + '<div class="flex items-center gap-2.5 min-w-0"><i class="fa-solid ' + icon + ' flex-shrink-0"></i>'
      +   '<div class="min-w-0"><div class="text-[12.5px] text-slate-700 truncate">' + esc(f.name) + pending + '</div>'
      +   '<div class="text-[10.5px] text-slate-400">' + meta.join(' · ') + '</div></div></div>'
      + '<div class="flex items-center gap-2 flex-shrink-0">'
      +   '<button data-file-act="download" data-id="' + f.id + '" class="text-slate-400 hover:text-slate-600" aria-label="Download"><i class="fa-solid fa-download"></i></button>'
      +   actions + '</div></div>';
}
const vaultEmpty = (text) => '<div class="text-center text-[12.5px] text-slate-400 border border-dashed border-slate-200 rounded-md py-8">' + text + '</div>';

function renderVault(){
    if(sharedVaultLoading || sharedVaultUnavailable){document.getElementById('vaultFileList').innerHTML=vaultEmpty(sharedVaultLoading?'Loading shared letters…':'Shared letters could not be loaded. Close and reopen the vault to retry.');return;}
    const v = ensureVault(vaultCompany);
    if(vaultFolder && !folderById(v, vaultFolder)) vaultFolder = null;
    const crumbs = [{id: '', name: vaultCompany}].concat(folderPath(v, vaultFolder));
    document.getElementById('vaultBreadcrumb').innerHTML = crumbs.map((c, i) => i === crumbs.length - 1
        ? '<span class="font-semibold text-slate-800">' + esc(c.name) + '</span>'
        : '<button data-crumb="' + esc(c.id) + '" class="text-sky-600 hover:underline">' + esc(c.name) + '</button><i class="fa-solid fa-chevron-right text-[9px] text-slate-300 mx-1"></i>').join('');

    const q = document.getElementById('vaultSearch').value.trim().toLowerCase();
    const type = document.getElementById('vaultTypeFilter').value;
    const intern = document.getElementById('vaultInternFilter').value;
    let html;
    if(q || type || intern){
        const files = v.files.filter(f => (!q || f.name.toLowerCase().includes(q)) && (!type || f.type === type) && (!intern || internOfFolder(v, f.folder) === intern));
        html = '<div class="text-[11.5px] text-slate-400">' + files.length + ' result' + (files.length === 1 ? '' : 's') + ' across all folders</div>'
          + (files.length ? files.map(f => vaultFileRow(v, f, true)).join('') : vaultEmpty('No files match your search or filters.'));
    } else {
        const folders = v.folders.filter(f => (f.parent || null) === vaultFolder);
        const files = v.files.filter(f => f.folder === vaultFolder);
        html = folders.map(f => vaultFolderRow(v, f)).join('') + files.map(f => vaultFileRow(v, f, false)).join('');
        if(!html) html = vaultEmpty(vaultFolder === 'interns'
            ? 'No interns deployed here yet. Each intern deployed to this company gets their own folder.'
            : 'This folder is empty. Upload a signed scan to keep a copy here.');
    }
    document.getElementById('vaultFileList').innerHTML = html;
}

function fillVaultFilters(v){
    document.getElementById('vaultTypeFilter').innerHTML = '<option value="">All document types</option>' + VAULT_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
    document.getElementById('vaultInternFilter').innerHTML = '<option value="">All interns</option>' + v.folders.filter(f => f.intern).map(f => '<option>' + esc(f.intern) + '</option>').join('');
    document.getElementById('vaultUploadType').innerHTML = VAULT_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
}

async function openVault(company, intern){
    vaultCompany = company;
    sharedVaultUnavailable=false;
    sharedVaultLoading=!!window.ICSharedLetters?.enabled();
    document.getElementById('vaultUploadBtn').disabled=sharedVaultLoading;
    if(sharedVaultLoading){
        vaultModal.classList.remove('hidden');renderVault();
        try{await window.ICSharedLetters.load(company);}
        catch(error){if(vaultCompany===company){sharedVaultUnavailable=true;showToast(error.message || 'Shared letters could not be loaded.','warn');}}
        if(vaultCompany!==company)return;
        sharedVaultLoading=false;
        document.getElementById('vaultUploadBtn').disabled=sharedVaultUnavailable;
    }
    const v = ensureVault(company);
    const internFolder = intern ? v.folders.find(f => f.intern === intern) : null;
    vaultFolder = internFolder ? internFolder.id : null;
    document.getElementById('vaultCompanyName').textContent = company;
    document.getElementById('vaultSearch').value = '';
    fillVaultFilters(v);
    document.getElementById('vaultUploadForm').classList.add('hidden');
    renderVault();
    vaultModal.classList.remove('hidden');
}

if(vaultModal){
    renderSiteLines();
    on('closeVaultModalBtn', 'click', () => vaultModal.classList.add('hidden'));
    ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => on(id, id === 'vaultSearch' ? 'input' : 'change', renderVault));

    // Quick open: any intern's folder from the directory page
    const picker = document.getElementById('internFolderPicker');
    if(picker){
        picker.innerHTML = '<option value="">Select an intern…</option>' + partnerNames().map(c => {
            const names = internsOf(c);
            return names.length ? '<optgroup label="' + esc(c) + '">' + names.map(n => '<option value="' + esc(c + '|' + n) + '">' + esc(n) + '</option>').join('') + '</optgroup>' : '';
        }).join('');
        picker.addEventListener('change', () => {
            if(!picker.value) return;
            const [company, intern] = picker.value.split('|');
            picker.value = '';
            openVault(company, intern);
        });
    }

    // Deep link from Roster / Attendance: ../coordinator/directory.html?vault=Company&intern=Name
    const params = new URLSearchParams(window.location.search);
    if(params.get('vault')) openVault(params.get('vault'), params.get('intern'));

    document.getElementById('vaultBreadcrumb').addEventListener('click', (e) => {
        const crumb = e.target.closest('[data-crumb]');
        if(!crumb) return;
        vaultFolder = crumb.dataset.crumb || null;
        renderVault();
    });

    document.getElementById('vaultFileList').addEventListener('click', async (e) => {
        const open = e.target.closest('[data-open-folder]');
        if(open){
            vaultFolder = open.dataset.openFolder;
            ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => document.getElementById(id).value = '');
            renderVault();
            return;
        }
        const v = ensureVault(vaultCompany);
        const folderBtn = e.target.closest('[data-folder-act]');
        if(folderBtn){
            const folder = folderById(v, folderBtn.dataset.id);
            if(folderBtn.dataset.folderAct === 'rename'){
                const name = (await askInput('Rename folder', folder.name) || '').trim();
                if(!name || name === folder.name) return;
                updateVault(vaultCompany, vt => { folderById(vt, folder.id).name = name; });
                showToast('Folder renamed to "' + name + '".', 'success');
            } else {
                if(filesUnder(v, folder.id) || subfolderIds(v, folder.id).length){ showToast('Move or delete what is inside "' + folder.name + '" first.', 'warn'); return; }
                if(!await askConfirm('Delete the empty folder "' + folder.name + '"?')) return;
                updateVault(vaultCompany, vt => { vt.folders = vt.folders.filter(f => f.id !== folder.id); });
                showToast('Folder deleted.', 'info');
            }
            renderVault();
            return;
        }
        const fileBtn = e.target.closest('[data-file-act]');
        if(!fileBtn) return;
        const file = v.files.find(f => f.id === fileBtn.dataset.id);
        if(!file) return;
        const act = fileBtn.dataset.fileAct;
        if(act==='share'){
            try{
                await window.ICSharedLetters.save(vaultCompany,file.folder,file.type,{name:file.name,data:file.data});
                updateVault(vaultCompany,v=>{v.files=v.files.filter(item=>item.id!==file.id);});
                renderVault();showToast('Letter shared with the company and student.','success');
            }catch(error){showToast(error.message || 'The letter could not be shared.','warn');}
            return;
        }
        if(file.sharedLetter){
            try{
                if(act==='download')downloadPrototypeFile(await window.ICSharedLetters.read(file));
                if(act==='replace'){replaceTargetId=file.id;document.getElementById('vaultReplaceInput').click();return;}
                if(act==='rename'){
                    const name=(await askInput('Rename file',file.name) || '').trim();if(!name || name===file.name)return;
                    const scan=await window.ICSharedLetters.read(file);
                    await window.ICSharedLetters.save(file.company,file.folder,file.type,{...scan,name},file);
                }
                if(act==='delete'){
                    if(!await askConfirm('Delete "'+file.name+'" from the shared vault?'))return;
                    await window.ICSharedLetters.remove(file.company,file);
                }
                renderVault();
            }catch(error){showToast(error.message || 'The letter could not be updated.','warn');}
            return;
        }
        if(act === 'download'){ downloadPrototypeFile(file); return; }
        if(act === 'replace'){ replaceTargetId = file.id; document.getElementById('vaultReplaceInput').click(); return; }
        if(act === 'rename'){
            const name = (await askInput('Rename file', file.name) || '').trim();
            if(!name || name === file.name) return;
            updateVault(vaultCompany, vt => { const x = vt.files.find(f => f.id === file.id); x.name = name; if(x.unlocked === VAULT_ME) delete x.unlocked; });
            showToast('File renamed to "' + name + '".', 'success');
        }
        if(act === 'delete'){
            if(!await askConfirm('Delete "' + file.name + '" from the vault? This cannot be undone.')) return;
            updateVault(vaultCompany, vt => { vt.files = vt.files.filter(f => f.id !== file.id); });
            showToast('"' + file.name + '" deleted.', 'info');
        }
        if(act === 'request-edit' || act === 'request-delete'){
            const kind = act === 'request-edit' ? 'edit' : 'delete';
            updateVault(vaultCompany, vt => { Object.assign(vt.files.find(f => f.id === file.id), {pending: kind, pendingBy: VAULT_ME}); });
            logAudit('Requested to ' + kind + ' ' + file.name + ' (' + vaultCompany + ' vault)', 'Pending');
            showToast(capitalize(kind) + ' request for "' + file.name + '" sent to ' + (VAULT_ME === 'hr' ? 'your coordinator' : vaultCompany + "'s HR") + '. The file stays as is until they approve.', 'info');
        }
        if(act === 'approve-req' || act === 'decline-req'){
            const kind = file.pending, by = (file.pendingBy || 'coordinator') === 'hr' ? vaultCompany + ' HR' : 'the coordinator';
            if(act === 'decline-req' && !await askConfirm('Decline the request of ' + by + ' for "' + file.name + '"? The file stays as is.')) return;
            if(act === 'approve-req' && kind === 'delete'){
                if(!await askConfirm('Approve the request of ' + by + ' and delete "' + file.name + '"?')) return;
                updateVault(vaultCompany, vt => { vt.files = vt.files.filter(f => f.id !== file.id); });
            } else updateVault(vaultCompany, vt => { const x = vt.files.find(f => f.id === file.id); if(act === 'approve-req') x.unlocked = x.pendingBy || 'coordinator'; delete x.pending; delete x.pendingBy; });
            logAudit((act === 'approve-req' ? 'Approved ' : 'Declined ') + 'the ' + kind + ' request of ' + by + ' for ' + file.name + ' (' + vaultCompany + ' vault)');
            showToast(act === 'decline-req' ? 'Request declined. The file stays as is.' : kind === 'delete' ? '"' + file.name + '" deleted.' : by.charAt(0).toUpperCase() + by.slice(1) + ' can now rename or replace "' + file.name + '" once.', act === 'decline-req' ? 'info' : 'success');
        }
        renderVault();
    });

    on('vaultReplaceInput', 'change', async (e) => {
        const picked = e.target.files[0];
        e.target.value = '';
        if(!picked || !replaceTargetId) return;
        if(picked.size > 1500000){ showToast('Choose a file under 1.5 MB.', 'warn'); return; }
        let data;
        try { data = await readPrototypeFile(picked); } catch(err){ showToast('Could not read the file. Please try again.', 'warn'); return; }
        const shared=ensureVault(vaultCompany).files.find(file=>file.id===replaceTargetId && file.sharedLetter);
        if(shared){
            try{await window.ICSharedLetters.save(shared.company,shared.folder,shared.type,{name:picked.name,data},shared);replaceTargetId=null;renderVault();showToast('Letter replaced for the company and student. The previous version is retained.','success');}
            catch(error){showToast(error.message || 'The letter could not be replaced.','warn');}
            return;
        }
        updateVault(vaultCompany, vt => {
            const f = vt.files.find(x => x.id === replaceTargetId);
            f.history = (f.history || []).concat({name: f.name, data: f.data || '', version: f.version, uploadedAt: f.uploadedAt});
            Object.assign(f, {name: picked.name, data, version: f.version + 1, uploadedAt: todayISO()});
            if(f.unlocked === VAULT_ME) delete f.unlocked;
        });
        replaceTargetId = null;
        renderVault();
        showToast('New version uploaded. The previous version is kept in the file history.', 'success');
    });

    on('vaultNewFolderBtn', 'click', async () => {
        const name = (await askInput('New folder name' + (vaultFolder ? ' (inside ' + folderLabel(ensureVault(vaultCompany), vaultFolder) + ')' : '')) || '').trim();
        if(!name) return;
        const v = ensureVault(vaultCompany);
        if(v.folders.some(f => (f.parent || null) === vaultFolder && f.name.toLowerCase() === name.toLowerCase())){ showToast('A folder with that name already exists here.', 'warn'); return; }
        updateVault(vaultCompany, vt => { vt.folders.push({id: 'f-' + vaultId(), name, parent: vaultFolder, system: false, owner: VAULT_ME}); });
        renderVault();
        showToast('Folder "' + name + '" created.', 'success');
    });

    // Upload: pick the signed scan, its document type and the folder to save it in
    on('vaultUploadBtn', 'click', () => {
        const form = document.getElementById('vaultUploadForm');
        if(!form.classList.contains('hidden')){ form.classList.add('hidden'); return; }
        const v = ensureVault(vaultCompany);
        const options = v.folders.filter(f => f.id !== 'interns').map(f => ({id: f.id, label: folderLabel(v, f.id)})).sort((a, b) => a.label.localeCompare(b.label));
        const target = vaultFolder && vaultFolder !== 'interns' ? vaultFolder : 'company';
        const sel = document.getElementById('vaultUploadFolder');
        sel.innerHTML = options.map(o => '<option value="' + esc(o.id) + '"' + (o.id === target ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
        document.getElementById('vaultUploadType').value = defaultTypeFor(v, target);
        form.classList.remove('hidden');
    });
    on('vaultUploadFolder', 'change', (e) => { document.getElementById('vaultUploadType').value = defaultTypeFor(ensureVault(vaultCompany), e.target.value); });
    on('vaultUploadCancel', 'click', () => document.getElementById('vaultUploadForm').classList.add('hidden'));
    on('vaultUploadSave', 'click', async () => {
        const input = document.getElementById('vaultFileInput');
        const picked = input.files[0];
        if(!picked){ showToast('Choose the signed scan to upload first.', 'warn'); return; }
        if(picked.size > 1500000){ showToast('Choose a file under 1.5 MB.', 'warn'); return; }
        let data;
        try { data = await readPrototypeFile(picked); } catch(err){ showToast('Could not read the file. Please try again.', 'warn'); return; }
        const folder = document.getElementById('vaultUploadFolder').value;
        const type = document.getElementById('vaultUploadType').value;
        if(window.ICSharedLetters?.enabled() && window.ICSharedLetters.kind(type)){
            const button=document.getElementById('vaultUploadSave');if(button.disabled)return;button.disabled=true;
            try{
                await window.ICSharedLetters.save(vaultCompany,folder,type,{name:picked.name,data});
                input.value='';document.getElementById('vaultUploadForm').classList.add('hidden');vaultFolder=folder;
                ['vaultSearch','vaultTypeFilter','vaultInternFilter'].forEach(id=>document.getElementById(id).value='');
                fillVaultFilters(ensureVault(vaultCompany));renderVault();
                showToast('Letter uploaded. The company and student can both view it.','success');
            }catch(error){showToast(error.message || 'The letter could not be uploaded.','warn');}
            finally{button.disabled=false;}
            return;
        }
        updateVault(vaultCompany, vt => { vt.files.push({id: vaultId(), name: picked.name, data, folder, type, owner: VAULT_ME, uploadedAt: todayISO(), version: 1}); });
        if(VAULT_ME === 'hr') logAudit('Partner HR uploaded ' + picked.name + ' (' + type + ') to ' + folderLabel(ensureVault(vaultCompany), folder), 'Pending');
        input.value = '';
        document.getElementById('vaultUploadForm').classList.add('hidden');
        vaultFolder = folder;
        ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => document.getElementById(id).value = '');
        renderVault();
        showToast('Uploaded to ' + folderLabel(ensureVault(vaultCompany), folder).replace(/\.$/, '') + '.' + (VAULT_ME === 'hr' ? ' Your coordinator will verify it.' : ''), 'success');
    });
}
