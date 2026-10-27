    // ---- Notifications and Recent Activity ----
function renderStudentRecordNotifications(me, mine, myTasks, mySub){
        const p = mine(), items = [], st = getJSON(SUB_STATUS_KEY, {});
        (p.history || []).slice(-4).forEach(x => items.push({date: x.date, icon: 'fa-route', tone: 'bg-sky-50 text-sky-600', text: 'Placement: <strong>' + esc(x.status) + '</strong>' + (x.note ? ' · ' + esc(x.note) : '')}));
        allTaskIds().forEach(id => {
            const x = mySub(id);
            if(!x.status || x.status === 'Pending Review') return;
            items.push({date: (st[id + '|' + me.name] || {}).at || x.date || '', icon: x.status === 'Verified' ? 'fa-check' : 'fa-rotate-left', tone: x.status === 'Verified' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500',
                text: 'Your <strong>' + esc(taskInfo(id).title) + '</strong> was ' + ({'Verified': 'verified and added to your resume', 'Needs Revision': 'returned for revision', 'Rejected': 'rejected'})[x.status] + (x.feedback ? ': “' + esc(x.feedback) + '”' : '')});
        });
        myTasks().filter(t => t.status === 'open' && !mySub(t.id).status).forEach(t => items.push({date: t.dueDate, icon: 'fa-file-lines', tone: 'bg-indigo-50 text-indigo-500', text: '<strong>' + esc(t.title) + '</strong> is due ' + formatDate(t.dueDate)}));
        const DAY_RESULT = {accepted: 'accepted', rejected: 'rejected', excused: 'excused', unexcused: 'kept as absent'};
        if(['Deployed', 'Hours complete', 'Completed'].includes(p.status)) internAttendance(p).filter(r => ['Flagged', 'Absent'].includes(r.status) && (r.review ? r.note : !r.note)).slice(0, 3).forEach(r => {
            const link = '<a href="../student/day-log.html?date=' + r.date + '" class="text-sky-600 font-semibold hover:underline">';
            if(r.review && r.note) items.push({date: r.date, icon: 'fa-comment-dots', tone: 'bg-sky-50 text-sky-600', text: 'Your coordinator ' + DAY_RESULT[r.review] + ' your ' + (r.status === 'Absent' ? 'absence' : 'flagged clock-in') + ' on ' + link + formatDate(r.date) + '</a>'});
            else if(!r.review && !r.note) items.push({date: r.date, icon: 'fa-comment-dots', tone: 'bg-amber-50 text-amber-500', text: '<strong>' + r.status + '</strong> on ' + formatDate(r.date) + '. ' + link + 'Explain this day</a>'});
        });
        const today = liveRecs(me.name)[todayISO()];
        if(today) items.push({date: todayISO(), icon: 'fa-location-dot', tone: 'bg-emerald-50 text-emerald-500', text: 'You timed in at ' + fmtClock(today.in) + (today.out != null ? ' and out at ' + fmtClock(today.out) : '')});
        const del = p.status === 'Completed' ? getDeletionRequests().find(r => r.name === me.name) : null;
        if(del && del.status === 'held') items.push({date: del.heldAt, icon: 'fa-hand', tone: 'bg-amber-50 text-amber-500', text: 'Your deletion request is on hold: ' + esc(del.holdReason)});
        const top = items.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
        const empty = '';
        const drop = document.querySelector('#notifDropdown .divide-y');
        if(drop) drop.innerHTML = top.length ? top.map(x => '<div class="px-4 py-3 text-[12.5px] text-slate-700 hover:bg-slate-50">' + x.text + '<div class="text-[10.5px] text-slate-400 mt-0.5">' + (x.date ? formatDate(x.date) : '') + '</div></div>').join('') : empty;
        const topButton = document.getElementById('notifBtn');
        if(topButton) topButton.querySelector('.notification-dot')?.classList.toggle('hidden', !top.length);
        const recent = [...document.querySelectorAll('#tab-overview h2')].find(x => x.textContent.trim() === 'Recent Activity');
        const box = recent && recent.closest('.bg-white').querySelector('.divide-y');
        if(box) box.innerHTML = top.length ? top.map(x => '<div class="flex items-start gap-3 px-5 py-3"><div class="w-7 h-7 rounded-full ' + x.tone + ' flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fa-solid ' + x.icon + ' text-[11px]"></i></div>'
            + '<div class="text-[13px] text-slate-600">' + x.text + ' <span class="text-slate-400">· ' + (x.date ? formatDate(x.date) : '') + '</span></div></div>').join('') : empty;
    }
