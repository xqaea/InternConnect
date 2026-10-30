// Show The Toast That Was Saved From The Previous Page
const pendingToast = sessionStorage.getItem('pendingToast');
if(pendingToast){
    sessionStorage.removeItem('pendingToast');
    const t = JSON.parse(pendingToast);
    showToast(t.message, t.type);
}

// Copy Class Code (header and register step 3)
function copyClassCode(){
    const code = activeClassCode() || (getJSON('ic_session', null) || {}).classCode || 'PHINMA-CS-2026';
    navigator.clipboard?.writeText(code).catch(() => {});
    showToast('Class code copied: ' + code, 'success');
}
on('copyClassCodeBtn', 'click', copyClassCode);
on('copyGeneratedCodeBtn', 'click', copyClassCode);

/* ============ Sidebar (dashboard screens only) ============ */

const sidebar = document.getElementById('sidebar');
const isStudentPortal = !!sidebar && document.body.dataset.role === 'student';   // student pages initialize their own sidebar
const overlay = document.getElementById('overlay');
const mobileToggle = document.getElementById('mobileToggle');
const mainFooter = document.getElementById('mainFooter');

initDashboardShell();
/* ============ Overview ============ */

on('viewClassworkLink', 'click', () => goTo('classwork'));

/* ============ Requests (join requests and deletion requests) ============ */

window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.shared = { goTo, openModal, closeModal, askConfirm, showToast, activeClassCode, activeClass, refreshHeaderCode, logAudit };

/* ============ Student / Alumni Portal (student pages only) ============ */
/* Uses the same localStorage data as the coordinator side: ic_users, ic_classes, ic_session, ic_alumni_requests. */
/* ============ Student side: placement, classwork, files, attendance (uses the coordinator data) ============ */
if(document.body.dataset.role === 'student') document.addEventListener('ic:student-ready', () => {
    initStudentRecords();
});

// Reveal the page after the shared initialization callbacks.
document.addEventListener('DOMContentLoaded', () => {
    if(document.body.dataset.role === 'student') return;
    if(sidebar && currentRole() === 'coordinator') return;
    document.documentElement.classList.add('app-ready');
}, {once: true});
