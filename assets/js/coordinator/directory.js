/* ============ Partner & MOA Directory: cards from the partner list, Add partner (no account), edit, remove ============ */
function monthYear(iso){ return new Date(iso + 'T00:00').toLocaleDateString('en-US', {month: 'short', year: 'numeric'}); }
function renderPartnerGrid(){
    const grid = document.getElementById('partnerGrid');
    if(grid){
        const placed = placementList();
        grid.innerHTML = partnerCompanies().map(c => {
            const info = partnerInfo(c), [label, tone] = moaStatus(info.moaUntil), e = esc(c);
            const deployed = placed.filter(p => p.company === c && ['Deployed', 'Hours complete'].includes(p.status)).length;
            const inProcess = placed.filter(p => p.company === c && ['Applied', 'Endorsed', 'Accepted'].includes(p.status)).length;
            const moaScan = ensureVault(c).files.some(f => f.type === 'MOA / MOU');
            return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">'
              + '<div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="font-semibold text-slate-900">' + e + '</div><div class="text-[12px] text-slate-500 mt-0.5">' + esc(info.industry || 'Industry not set') + '</div></div>'
              + '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ' + tone + '">' + label + '</span></div>'
              + '<div class="text-[12px] text-slate-500 mt-3">' + (info.moaUntil ? (label === 'Expired' ? 'MOA expired ' : 'MOA valid until ') + '<strong class="text-slate-700">' + monthYear(info.moaUntil) + '</strong>' : 'No MOA date yet') + ' · '
              + (moaScan ? '<span class="text-emerald-700"><i class="fa-solid fa-check text-[10px] mr-0.5"></i>MOA scan in vault</span>' : '<span class="text-amber-600">No MOA scan in vault yet</span>') + '</div>'
              + '<div class="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 text-[12.5px]"><span class="text-slate-600"><i class="fa-solid fa-users mr-1.5 text-slate-400"></i>' + deployed + ' intern' + (deployed === 1 ? '' : 's') + ' deployed' + (inProcess ? ' · ' + inProcess + ' in process' : '') + '</span>'
              + '<span class="text-slate-400">' + (info.hr ? 'HR: ' + esc(info.hr) : 'No HR contact') + '</span></div>'
              + '<div class="mt-2 text-[11px] ' + (info.accounts.length ? 'text-sky-700' : 'text-slate-400') + '"><i class="fa-solid ' + (info.accounts.length ? 'fa-circle-check' : 'fa-user-slash') + ' mr-1"></i>'
              + (info.accounts.length ? 'Uses InternConnect · ' + esc(info.accounts.map(a => a.email).join(', ')) : 'No partner account · you manage its records') + '</div>'
              + '<div class="flex gap-3 mt-2 text-[11.5px] font-semibold"><button class="partner-edit-btn text-sky-600 hover:text-sky-700" data-company="' + e + '"><i class="fa-solid fa-pen mr-1"></i>Edit details</button>'
              + (info.removable && !deployed && !inProcess ? '<button class="partner-remove-btn text-red-600 hover:text-red-700" data-company="' + e + '"><i class="fa-solid fa-trash mr-1"></i>Remove</button>' : '') + '</div>'
              + '<button class="open-vault-btn mt-3 w-full text-[12px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-2 rounded-md transition" data-company="' + e + '"><i class="fa-solid fa-vault mr-1.5"></i>Open Vault</button></div>';
        }).join('') || '<div class="md:col-span-2 bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-[12.5px] text-slate-500">No partner companies in this batch yet.<br>Add one, or approve a partner company request on the Requests page.</div>';
    }
    renderSiteLines();
}
function openPartnerModal(company){
    let m = document.getElementById('partnerModal');
    const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 mb-3';
    const label = (id, t) => '<label class="text-[12.5px] font-medium text-slate-600 block mb-1" for="' + id + '">' + t + '</label>';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="partnerModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 id="pmTitle" class="font-bold text-slate-900">Add partner</h3><button data-pm="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p class="text-[12px] text-slate-500 mb-4">For partners that will not use InternConnect. Partners that sign up are added here once you approve them in Requests.</p>'
          + label('pmName', 'Company name') + '<input id="pmName" class="' + field + '" placeholder="ex. Tech Solutions Inc.">'
          + label('pmIndustry', 'Industry') + '<input id="pmIndustry" class="' + field + '" placeholder="ex. Software Development">'
          + label('pmHr', 'HR / supervisor contact') + '<input id="pmHr" class="' + field + '" placeholder="ex. Ms. Ana Reyes · ana@company.com">'
          + label('pmMoa', 'MOA valid until') + '<input id="pmMoa" type="date" class="' + field + '">'
          + '<p class="text-[11px] text-slate-400">Keep the signed MOA scan in the vault\'s Agreements folder. Renew by changing the date after the new MOA is signed.</p>'
          + '<div class="flex justify-end gap-2.5 mt-5"><button data-pm="close" class="text-[12.5px] font-medium text-slate-500 hover:text-slate-700 px-3.5 py-2">Cancel</button><button data-pm="save" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">Save</button></div></div></div>');
        m = document.getElementById('partnerModal');
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-pm]'); if(!b) return;
            if(b.dataset.pm === 'close') return closeModal(m);
            const val = (id) => document.getElementById(id).value.trim(), name = m._company || val('pmName');
            if(!name) return showToast('Type the company name.', 'warn');
            if(!m._company && partnerCompanies().some(n => n.toLowerCase() === name.toLowerCase())) return showToast(name + ' is already in the directory.', 'warn');
            const all = getJSON(PARTNERS_KEY, {});
            all[name] = Object.assign(all[name] || {}, {industry: val('pmIndustry'), hr: val('pmHr'), moaUntil: val('pmMoa')}, m._company ? {} : {addedBy: 'coordinator', addedAt: todayISO(), classCode: activeClassCode()});
            localStorage.setItem(PARTNERS_KEY, JSON.stringify(all));
            logAudit(m._company ? 'Updated the details of ' + name + (val('pmMoa') ? ' · MOA valid until ' + val('pmMoa') : '') : 'Added partner company ' + name + ' (no partner account)');
            closeModal(m);
            renderPartnerGrid();
            showToast(m._company ? 'Partner details saved.' : name + ' added. Students can now apply to it.', 'success');
        });
    }
    const info = company ? partnerInfo(company) : {};
    m._company = company || '';
    document.getElementById('pmTitle').textContent = company ? 'Edit partner details' : 'Add partner';
    document.getElementById('pmName').value = company || '';
    document.getElementById('pmName').disabled = !!company;
    document.getElementById('pmIndustry').value = info.industry || '';
    document.getElementById('pmHr').value = info.hr || '';
    document.getElementById('pmMoa').value = info.moaUntil || '';
    openModal(m);
}
document.addEventListener('click', async (e) => {
    const b = e.target.closest('.open-vault-btn, .partner-edit-btn, .partner-remove-btn, #addPartnerBtn');
    if(!b) return;
    if(b.id === 'addPartnerBtn') return openPartnerModal('');
    const c = b.dataset.company;
    if(b.classList.contains('open-vault-btn')) return openVault(c);
    if(b.classList.contains('partner-edit-btn')) return openPartnerModal(c);
    if(!await askConfirm('Remove ' + c + ' from the directory? Its vault is kept.')) return;
    const all = getJSON(PARTNERS_KEY, {}); delete all[c]; localStorage.setItem(PARTNERS_KEY, JSON.stringify(all));
    logAudit('Removed partner company ' + c + ' from the directory');
    renderPartnerGrid();
    showToast(c + ' removed.', 'info');
});

renderPartnerGrid();

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    window.ICCore?.coordinator?.initDirectoryExport?.();
  }, { once: true });
})();
