// Sub Tabs (also used by the Batch Roster)
document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.subtab).classList.remove('hidden');
    });
});

// Sample requests only exist in the demo batch. Every other batch only shows its real sign ups.
// Handled sample requests are remembered so they do not come back after a refresh.
const SAMPLE_JOINS_KEY = 'ic_sample_joins_done';
const SAMPLE_JOINS = [
    {sample: 's-mc', role: 'student', name: 'Mikaela Cruz', studentNumber: '2023-0199', requestedAt: '2026-09-16'},
    {sample: 's-rt', role: 'student', name: 'Ronan Tolentino', studentNumber: '2023-0142', requestedAt: '2026-09-16'},
    {sample: 's-bs', role: 'student', name: 'Bea Santiago', studentNumber: '2023-0210', requestedAt: '2026-09-15'},
    {sample: 'p-nx', role: 'partnercompany', company: 'Nexora Systems Inc.', contact: 'Ms. Karla P., HR Lead'},
    {sample: 'p-cd', role: 'partnercompany', company: 'Cavite Digital Hub', contact: 'Mr. Ian F., Operations'}
];

function updateRequestCounts(){
    const count = (id) => document.querySelectorAll('#' + id + ' > .bg-white').length;
    document.getElementById('wrStudentsCount').textContent = '(' + count('wr-students') + ')';
    document.getElementById('wrPartnersCount').textContent = '(' + count('wr-partners') + ')';
    document.getElementById('wrDeletionsCount').textContent = '(' + count('wr-deletions') + ')';
}
function updateSidebarRequestBadge(){
    const badge = document.getElementById('waitingBadge');
    if(!badge) return;
    const code = activeClassCode();
    const real = getUsers().filter(u => u.classCode === code && u.status === 'pending').length;
    const sampleDone = getJSON(SAMPLE_JOINS_KEY, []);
    const sample = !(getJSON('ic_session', {}) || {}).databaseAccount && code === SEED_CODE ? SAMPLE_JOINS.filter(x => !sampleDone.includes(x.sample)).length : 0;
    const count = real + sample;
    const viewedRequests = !!document.getElementById('tab-requests');
    badge.textContent = String(count);
    badge.classList.toggle('hidden', !count || viewedRequests);
    badge.setAttribute('aria-label', count + ' pending requests');
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.updateRequestBadge = updateSidebarRequestBadge;

function openSidebar(){
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    mobileToggle.classList.add('hidden');
}

function closeSidebar(){
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    mobileToggle.classList.remove('hidden');
}

function initCoordinatorSidebar(){
    if(!(sidebar && !isStudentPortal)) return;
    // Nav Links (go to the matching page, logout goes back to login)
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', async () => {
            if(btn.dataset.tab === 'logout'){
                if(!await askConfirm('Log out of InternConnect?')) return;
                if((getJSON('ic_session', {}) || {}).databaseAccount){ try { await window.ICCoordinatorApi.logout(); } catch(e) {} }
                sessionStorage.removeItem('ic_coordinator_token');
                localStorage.removeItem('ic_session');   // back to the default theme
                goTo('login', 'You have been logged out.', 'info');
            } else {
                goTo(btn.dataset.tab);
            }
        });
    });

    // Mobile Open and Close
    mobileToggle.addEventListener('click', openSidebar);
    document.getElementById('mobileCloseBtn').addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Desktop Collapse (remembered so it stays the same on every page)
    if(localStorage.getItem('sidebarCollapsed') === 'true'){
        sidebar.classList.add('collapsed');
        mainFooter.classList.add('collapsed');
    }
    document.getElementById('collapseBtn').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainFooter.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });

    // Notifications Dropdown
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown?.classList.toggle('hidden');
        notifBtn.querySelector('.notification-dot')?.classList.add('hidden');
        notifBtn.setAttribute('aria-label', 'Notifications');
    });
    const coordinatorNotifList = notifDropdown?.querySelector('.divide-y');
    if(coordinatorNotifList && !isStudentPortal) coordinatorNotifList.innerHTML = '';
    if(notifBtn && !isStudentPortal) notifBtn.querySelector('.notification-dot')?.classList.add('hidden');
    document.addEventListener('click', (e) => { if(notifDropdown && !notifDropdown.contains(e.target)) notifDropdown.classList.add('hidden'); });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initSidebar = initCoordinatorSidebar;

// Coordinator Classwork: only real submissions should create a pending-review banner.
// The built-in task examples are presentation data and must not look like live logs.
function renderPendingLogsBanner(){
    const countEl = document.getElementById('pendingLogsCount'), banner = document.getElementById('pendingLogsBanner');
    if(!countEl || !banner) return;
    const saved = savedTaskSubmissions(), statuses = getJSON(SUB_STATUS_KEY, {});
    const count = Object.entries(saved).reduce((total, [taskId, submissions]) => total + (Array.isArray(submissions) ? submissions.filter(sub => {
        const status = sub.databaseReport?sub.status:statuses[taskId + '|' + sub.name]?.status || sub.status;
        return status === 'Pending Review';
    }).length : 0), 0);
    countEl.textContent = count;
    banner.classList.toggle('hidden', count === 0);
}
renderPendingLogsBanner();

// Coordinator notifications: show real student task submissions, not deadline or sample-log reminders.
function renderCoordinatorSubmissionNotifications(){
    if(isStudentPortal) return;
    const drop = document.querySelector('#notifDropdown .divide-y'), button = document.getElementById('notifBtn');
    if(!drop || !button) return;
    const saved = savedTaskSubmissions(), items = Object.entries(saved).flatMap(([taskId, submissions]) =>
        (Array.isArray(submissions) ? submissions : []).map(sub => ({taskId, sub}))
    ).sort((a, b) => String(b.sub.date || '').localeCompare(String(a.sub.date || ''))).slice(0, 8);
    if(!items.length){
        drop.innerHTML = '<div class="px-4 py-5 text-center text-[12px] text-slate-400">No new activity yet.</div>';
        button.querySelector('.notification-dot')?.classList.add('hidden');
        return;
    }
    drop.innerHTML = items.map(({taskId, sub}) => {
        const title = (findTask(taskId) || taskData[taskId] || {}).title || 'Task submission';
        const status = sub.status || 'Pending Review';
        return '<div class="px-4 py-3 flex gap-3 hover:bg-slate-50">'
            + '<div class="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-file-arrow-up text-[11px]"></i></div>'
            + '<div class="min-w-0"><div class="text-[12.5px] text-slate-700"><strong>' + esc(sub.name || 'A student') + '</strong> submitted <strong>' + esc(title) + '</strong>.</div>'
            + '<div class="text-[10.5px] text-slate-400 mt-0.5">' + esc(status) + (sub.date ? ' · ' + esc(formatDate(sub.date)) : '') + '</div></div></div>';
    }).join('');
    button.querySelector('.notification-dot')?.classList.remove('hidden');
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.renderSubmissionNotifications = renderCoordinatorSubmissionNotifications;

/* Shared coordinator page boundary. Feature modules consume these helpers through ICCore. */
(function () {
  'use strict';
  window.ICCore = window.ICCore || {};
  window.ICCore.coordinator = window.ICCore.coordinator || {};
  document.addEventListener('DOMContentLoaded', async () => {
    if((getJSON('ic_session', {}) || {}).databaseAccount){
      try{
        if(!sessionStorage.getItem('ic_coordinator_token')) throw {status: 401};
        await window.syncCoordinatorState();
      }catch(error){
        if(error.status === 401 || error.status === 403){ localStorage.removeItem('ic_session'); sessionStorage.removeItem('ic_coordinator_token'); }
        goTo('login', error.message || 'Please sign in again to verify your coordinator account.', 'warn');
        return;
      }
    }
    window.ICCore.coordinator.updateRequestBadge?.();
    window.ICCore.coordinator.initSidebar?.();
    window.ICCore.coordinator.renderSubmissionNotifications?.();
    document.dispatchEvent(new Event('ic:coordinator-ready'));
    document.documentElement.classList.add('app-ready');
  }, { once: true });
})();
