// "Discard changes?" guard: pop up forms and pages ask before throwing away what the user typed
const DISCARD_SKIP = /search|filter|sort/i;
const MODAL_SAVE = /^(save|submit|upload|post|publish|create|update|apply|record|confirm|done)\b/i;
const PAGE_SAVE = /^(save|submit|resubmit|upload|post|publish|create|update|apply|record|confirm|approve|reject|request|send|grade|mark)\b/i;
let pageDirty = false, discardBypass = false;
// Login, sign up and forgot password move to the next page with what was typed, so nothing there is lost
const NO_PAGE_DISCARD = /\/pages\/auth\//.test(location.pathname);
function discardModalOf(el){ const m = el && el.closest('[id$="Modal"], [id$="modal"], .fixed.inset-0'); return m && !m.matches('[data-ask]') ? m : null; }
function discardAsk(){ return askConfirm('You have unsaved changes. If you leave now, they will be lost.', {title: 'Discard changes?', ok: 'Discard', danger: true}); }
function isDismissBtn(b, label){
    if(b.id === 'closeBatchBtn') return false;
    return /^(cancel|close|discard|back)$/i.test(label) || (!label && !!b.querySelector('.fa-xmark')) || /^(cancel|close)|(cancel|close)(btn)?$/i.test(b.id)
        || [...b.attributes].some(a => a.name.startsWith('data-') && (/close|cancel/i.test(a.name) || /^(close|cancel)$/i.test(a.value)));
}
['input', 'change'].forEach(t => document.addEventListener(t, (e) => {
    const f = e.target;
    if(!e.isTrusted || !f.matches || !f.matches('input, textarea, select') || f.closest('[data-ask]')) return;
    if(['button', 'submit', 'hidden'].includes(f.type) || DISCARD_SKIP.test([f.id, f.name, f.className, f.placeholder].join(' '))) return;
    const m = discardModalOf(f);
    if(m) m.dataset.dirty = '1';
    else if(!NO_PAGE_DISCARD && f.matches('textarea, input:not([type]), input[type=text], input[type=email], input[type=number], input[type=url], input[type=tel]')) pageDirty = true;
}, true));
new MutationObserver(list => list.forEach(r => { const t = r.target; if(t.dataset && t.dataset.dirty && t.classList.contains('hidden')) delete t.dataset.dirty; }))
    .observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['class']});
document.addEventListener('click', (e) => {
    if(discardBypass || !e.target.closest || e.target.closest('[data-ask]')) return;
    const b = e.target.closest('button, a');
    if(!b) return;
    const label = (b.textContent || '').trim(), m = discardModalOf(b);
    const proceed = (clean) => { e.preventDefault(); e.stopImmediatePropagation(); discardAsk().then(ok => { if(!ok) return; clean(); discardBypass = true; try { b.click(); } finally { discardBypass = false; } }); };
    if(m){
        if(m.dataset.dirty && isDismissBtn(b, label)) proceed(() => delete m.dataset.dirty);
        else if(MODAL_SAVE.test(label)) setTimeout(() => { delete m.dataset.dirty; }, 0);
        return;
    }
    if(PAGE_SAVE.test(label)){ setTimeout(() => { pageDirty = false; }, 0); return; }
    const href = b.tagName === 'A' ? (b.getAttribute('href') || '') : '';
    const leaving = b.matches('.nav-link, #logoutBtn') || (href && !href.startsWith('#') && !href.startsWith('javascript') && b.target !== '_blank');
    if(pageDirty && leaving) proceed(() => { pageDirty = false; });
}, true);
window.addEventListener('beforeunload', (e) => {
    if(pageDirty || [...document.querySelectorAll('[data-dirty]')].some(m => !m.classList.contains('hidden'))){ e.preventDefault(); e.returnValue = ''; }
});
