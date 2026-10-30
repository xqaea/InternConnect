/* ============ Overview: pipeline, needs attention, task tracker ============ */

function attentionItems(){
    const items = [];
    const add = (icon, tone, html, href) => items.push({icon, tone, html, href});
    placementList().forEach(p => {
        const who = '<strong class="text-slate-900">' + esc(p.name) + '</strong>';
        if(p.status === 'Applied' && !hasDoc(p.company, p.name, 'Endorsement letter')) add('fa-file-signature', 'sky', 'Upload the signed endorsement letter of ' + who, pages.placements + '?stage=Applied');
        if(p.status === 'Applied' && hasDoc(p.company, p.name, 'Endorsement letter')) add('fa-file-signature', 'sky', 'Endorsement scan is in. Mark ' + who + ' as endorsed', pages.placements + '?stage=Applied');
        if(p.status === 'Endorsed') add('fa-hourglass-half', 'slate', 'Waiting for the acceptance letter of ' + who, pages.placements + '?stage=Endorsed');
        if(p.status === 'Accepted') add('fa-plane-departure', 'emerald', 'Confirm deployment of ' + who, pages.placements + '?stage=Accepted');
        if(pendingFlags(p)) add('fa-location-crosshairs', 'red', pendingFlags(p) + ' clock-in(s) of ' + who + ' were outside the geofence. Review them', profileLink(p.name) + '#attendance');
        if(pendingExcuses(p)) add('fa-comment-dots', 'amber', who + ' explained ' + pendingExcuses(p) + ' absence(s). Excuse or keep them', profileLink(p.name) + '#attendance');
        if(internAtRisk(p)) add('fa-triangle-exclamation', 'red', who + (expectedHours(p) == null ? ' is at risk: ' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + ' hours' : ' is behind schedule: ' + (p.hours || 0) + ' of ' + expectedHours(p) + ' expected hours'), profileLink(p.name));
        if(p.status === 'Hours complete') add('fa-clipboard-check', 'amber', hasDoc(p.company, p.name, 'Supervisor evaluation') ? who + ' is ready to mark completed' : who + ' finished the hours. Upload the supervisor evaluation', hasDoc(p.company, p.name, 'Supervisor evaluation') ? pages.roster : profileLink(p.name));
    });
    return items;
}
const TONE = {sky: 'bg-sky-50 text-sky-600', slate: 'bg-slate-100 text-slate-500', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-500', amber: 'bg-amber-50 text-amber-600'};

// The numbers behind the stat cards (also used by Export Summary so the file always matches the screen)
function overviewMetrics(){
    const all = placementList();
    const active = all.filter(p => ['Deployed', 'Hours complete'].includes(p.status));
    const inBatch = all.filter(p => !['Completed', 'Withdrawn'].includes(p.status));
    const avg = active.length ? Math.round(active.reduce((t, p) => t + (p.hours || 0), 0) / active.length) : 0;
    const flags = active.reduce((t, p) => t + pendingFlags(p), 0);
    const withInterns = partnerNames().filter(c => active.some(p => p.company === c)).length;
    return {all, active, inBatch, avg, flags, withInterns};
}

function renderOverview(){
    getDeletionRequests();
    const {all, active, inBatch, avg, flags, withInterns} = overviewMetrics();
    const card = (href, value, label, sub, icon, tone) => '<a href="' + href + '" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-sky-300 transition">'
        + '<div class="flex items-center justify-between"><div class="text-2xl font-extrabold text-slate-900">' + value + '</div><div class="w-9 h-9 rounded-lg ' + tone + ' flex items-center justify-center"><i class="fa-solid ' + icon + '"></i></div></div>'
        + '<div class="text-[12.5px] text-slate-500 mt-1">' + label + '</div><div class="text-[11px] text-slate-400">' + sub + '</div></a>';
    document.getElementById('overviewStats').innerHTML =
        card(pages.attendance, active.length, 'Deployed interns', 'of ' + inBatch.length + ' students in this batch', 'fa-user-graduate', 'bg-sky-50 text-sky-600')
        + card(pages.attendance, flags, 'Flagged clock-ins', flags ? 'outside the geofence, needs review' : 'all reviewed', 'fa-location-crosshairs', flags ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500')
        + '<a href="' + pages.attendance + '" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-sky-300 transition col-span-2 sm:col-span-1"><div class="text-[12.5px] text-slate-500 mb-1.5">Average rendered hours</div>'
        + '<div class="text-lg font-bold text-slate-900 mb-1.5">' + avg + ' <span class="text-[12px] font-medium text-slate-400">/ ' + REQUIRED_HOURS + ' hrs</span></div>'
        + '<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-sky-600" style="width:' + Math.min(100, Math.round(avg / REQUIRED_HOURS * 100)) + '%"></div></div><div class="text-[11px] text-slate-400 mt-1.5">deployed interns only</div></a>'
        + card(pages.partners, partnerNames().length, 'Partner companies', withInterns + ' with deployed interns', 'fa-handshake', 'bg-emerald-50 text-emerald-500');
    document.getElementById('overviewPipeline').innerHTML = PLACEMENT_STEPS.map(stage =>
        '<a href="' + pages.placements + '?stage=' + encodeURIComponent(stage) + '" class="rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 px-3 py-2 transition">'
        + '<div class="text-[10.5px] text-slate-500 truncate">' + stage + '</div><div class="text-lg font-bold text-slate-900 leading-tight">' + all.filter(p => p.status === stage).length + '</div></a>').join('');

    const items = attentionItems();
    document.getElementById('overviewAttentionCount').textContent = items.length ? '(' + items.length + ')' : '';
    document.getElementById('overviewAttention').innerHTML = items.length ? items.map(i =>
        '<a href="' + i.href + '" class="flex items-start gap-3 px-5 py-2.5 hover:bg-slate-50">'
        + '<div class="w-7 h-7 rounded-full ' + TONE[i.tone] + ' flex items-center justify-center flex-shrink-0"><i class="fa-solid ' + i.icon + ' text-[11px]"></i></div>'
        + '<div class="text-[12.5px] text-slate-600 pt-1">' + i.html + '</div></a>').join('')
        : '<div class="px-5 py-6 text-[12.5px] text-slate-400 text-center">All caught up.</div>';

    const activity = document.getElementById('overviewActivity');
    if(activity && currentBatchCode() !== SEED_CODE) activity.innerHTML = '<div class="px-5 py-6 text-[12.5px] text-slate-400 text-center">No activity yet in this batch.</div>';

    const tasks = getAllTasks().filter(t => t.classCode === activeClassCode() && t.status !== 'archived');
    document.getElementById('overviewTasks').innerHTML = tasks.length ? tasks.map(t => {
        const pct = t.total ? Math.min(100, Math.round(t.turnedIn / t.total * 100)) : 0;
        const full = pct >= 100;
        return '<a href="' + pages.taskdetail + '?task=' + encodeURIComponent(t.id) + '" class="block px-5 py-3 hover:bg-slate-50">'
          + '<div class="flex items-center justify-between mb-1.5"><span class="text-[13px] font-medium text-slate-700">' + esc(t.title) + (t.status === 'closed' ? ' <span class="text-[10.5px] font-normal text-slate-400">· closed</span>' : '') + '</span>'
          + '<span class="text-[12px] font-semibold ' + (full ? 'text-emerald-700' : 'text-sky-700') + '">' + t.turnedIn + ' / ' + t.total + ' submitted</span></div>'
          + '<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ' + (full ? 'bg-emerald-500' : 'bg-sky-600') + '" style="width:' + pct + '%"></div></div></a>';
    }).join('') : '<div class="px-5 py-6 text-[12.5px] text-slate-400 text-center">No active tasks.</div>';
}
function initCoordinatorOverview(){
    if(document.getElementById('overviewPipeline')) renderOverview();
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initOverview = initCoordinatorOverview;

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initSummaryExport?.();
    window.ICCore?.coordinator?.initOverview?.();
  }, { once: true });
})();
