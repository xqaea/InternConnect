// Styled replacement for window.confirm(). Resolves true when the user confirms.
function askConfirm(message, opts){
    opts = opts || {};
    const msg = String(message || '');
    const danger = opts.danger != null ? opts.danger : /^(Delete|Remove|Reject|Archive|Close|Decline|Cancel|Log out|Request deletion|Mark .* withdrawn|Approve the request .* delete|.* did not accept)/.test(msg);
    const word = (msg.match(/^(Delete|Remove|Reject|Archive|Close|Decline|Log out|Apply|Approve)/) || [])[1];
    const okLabel = opts.ok || (/^Cancel /.test(msg) ? 'Yes, cancel' : /^Request deletion/.test(msg) ? 'Request deletion' : /^There is no signed/.test(msg) ? 'Open folder' : word || 'Confirm');
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4';
        wrap.dataset.ask = '1';
        wrap.innerHTML = '<div role="dialog" aria-modal="true" class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">'
            + '<div class="flex items-start gap-4"><div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center ' + (danger ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600') + '"><i class="fa-solid ' + (danger ? 'fa-triangle-exclamation' : 'fa-circle-question') + '"></i></div>'
            + '<div class="min-w-0"><h3 class="text-[15px] font-bold text-slate-900"></h3><p class="mt-1.5 text-[13px] text-slate-600 whitespace-pre-line break-words"></p></div></div>'
            + '<div class="mt-6 flex justify-end gap-2"><button data-c="no" class="text-[12.5px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md transition">Cancel</button>'
            + '<button data-c="yes" class="text-[12.5px] font-semibold text-white px-4 py-2 rounded-md transition ' + (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700') + '"></button></div></div>';
        wrap.querySelector('h3').textContent = opts.title || 'Are you sure?';
        wrap.querySelector('p').textContent = msg;
        wrap.querySelector('[data-c="yes"]').textContent = okLabel;
        const done = (v) => { document.removeEventListener('keydown', key, true); wrap.remove(); resolve(v); };
        const key = (e) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); done(false); } else if(e.key === 'Enter'){ e.preventDefault(); done(true); } };
        wrap.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-c]'); if(b) done(b.dataset.c === 'yes'); else if(e.target === wrap) done(false); });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(wrap);
        wrap.querySelector('[data-c="yes"]').focus();
    });
}

// Styled replacement for window.prompt(). Resolves the typed text, or null when cancelled.
function askInput(message, value){
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4';
        wrap.dataset.ask = '1';
        wrap.innerHTML = '<div role="dialog" aria-modal="true" class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">'
            + '<p class="text-[13.5px] font-semibold text-slate-800 whitespace-pre-line break-words"></p>'
            + '<textarea rows="3" class="mt-3 w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>'
            + '<div class="mt-4 flex justify-end gap-2"><button data-c="no" class="text-[12.5px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-md transition">Cancel</button>'
            + '<button data-c="yes" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md transition">OK</button></div></div>';
        wrap.querySelector('p').textContent = String(message || '');
        const box = wrap.querySelector('textarea');
        box.value = value || '';
        const done = (v) => { document.removeEventListener('keydown', key, true); wrap.remove(); resolve(v); };
        const key = (e) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); done(null); } else if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); done(box.value); } };
        wrap.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('[data-c]'); if(b) done(b.dataset.c === 'yes' ? box.value : null); else if(e.target === wrap) done(null); });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(wrap);
        box.focus(); box.select();
    });
}
