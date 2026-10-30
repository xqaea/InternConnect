const NEXT_HINT = {
    'Not placed': 'Record where the student applied on the Placements page.',
    'Applied': 'Upload the signed endorsement letter scan, then mark the student as endorsed.',
    'Endorsed': "Waiting for the company's signed acceptance letter.",
    'Accepted': 'Confirm deployment on the Placements page to start attendance monitoring.',
    'Hours complete': 'Upload the supervisor evaluation, then mark the intern as completed in the Roster.',
    'Withdrawn': 'Withdrawn. Records are kept for 5 years.'
};

let attFilter = '';
let attShowAll = false;
function attendanceCard(p, deployed){
    const wrap = (body, right) => '<div id="attendance" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 scroll-mt-4">'
        + '<div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Attendance record</div>' + (right || '') + '</div>' + body + '</div>';
    if(!deployed) return wrap('<div class="text-[12.5px] text-slate-500">Attendance starts after deployment.</div>');
    const recs = internAttendance(p);
    if(!recs.length) return wrap('<div class="text-[12.5px] text-slate-500">No clock-ins yet. Records show up here after the intern\'s first clock-in.</div>');

    const worked = recs.filter(r => r.status !== 'Absent' && r.status !== 'Holiday');
    const workDays = recs.filter(r => r.status !== 'Holiday' && r.status !== 'Outside schedule').length;
    const count = (st) => recs.filter(r => r.status === st).length;
    const flagsPending = recs.filter(r => r.status === 'Flagged' && !r.review).length;
    const rejected = recs.filter(r => r.review === 'rejected').reduce((t, r) => t + r.hours, 0);
    const excused = recs.filter(r => r.status === 'Absent' && r.review === 'excused').length;
    const last = worked[0];
    const stat = (label, value, sub, tone) => '<div class="rounded-lg border border-slate-200 px-3 py-2.5"><div class="text-[10.5px] text-slate-500">' + label + '</div>'
        + '<div class="text-lg font-bold leading-tight ' + (tone || 'text-slate-900') + '">' + value + '</div>' + (sub ? '<div class="text-[10.5px] text-slate-400 truncate">' + sub + '</div>' : '') + '</div>';
    const summary = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">'
        + stat('Days present', worked.length, 'of ' + workDays + ' working days' + (count('Holiday') ? ' · ' + count('Holiday') + ' holiday' + (count('Holiday') > 1 ? 's' : '') : ''))
        + stat('Hours rendered', p.hours || 0, 'of ' + REQUIRED_HOURS + (rejected ? ' · ' + rejected + ' rejected' : ''))
        + stat('Late', count('Late'), 'after ' + fmtClock(clockMins(scheduleOf(p).timeIn) + scheduleOf(p).grace), count('Late') ? 'text-amber-600' : '')
        + stat('Absent', count('Absent') - excused, excused ? excused + ' excused' : 'no clock-in', count('Absent') - excused ? 'text-slate-700' : '')
        + stat('Flagged', flagsPending, flagsPending ? 'needs your review' : 'all reviewed', flagsPending ? 'text-red-600' : '')
        + stat('Last clock-in', formatDate(last.date).replace(/, \d{4}$/, ''), fmtClock(last.timeIn))
        + '</div>';

    const chips = [['', 'All'], ['Late', 'Late'], ['Absent', 'Absent'], ['Flagged', 'Flagged']].map(([f, label]) =>
        '<button data-pf-act="att-filter" data-f="' + f + '" class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ' + (attFilter === f ? 'bg-sky-600 text-white border-sky-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50') + '">' + label + '</button>').join('');
    const right = '<div class="flex items-center gap-1.5 flex-wrap">' + chips
        + '<button data-pf-act="att-export" class="ml-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-md"><i class="fa-solid fa-file-pdf mr-1"></i>Export PDF</button></div>';

    const list = recs.filter(r => !attFilter || r.status === attFilter);
    const shown = attShowAll ? list : list.slice(0, 10);
    const photo = (r, kind) => '<button data-pf-act="att-photo" data-date="' + r.date + '" data-kind="' + kind + '" class="flex items-center gap-2 group" title="View photo and location">'
        + '<img src="' + clockPhoto(p, r, kind) + '" alt="' + (kind === 'in' ? 'Clock-in' : 'Clock-out') + ' photo" class="w-7 h-9 rounded object-cover border border-slate-200 group-hover:ring-2 group-hover:ring-sky-300">'
        + '<span class="text-[12px] text-slate-700">' + fmtClock(kind === 'in' ? r.timeIn : r.timeOut) + '</span></button>';
    const noteHtml = (r) => !r.note ? '' : '<div class="mt-1 text-[10.5px] text-slate-500 max-w-[230px] whitespace-normal leading-snug" title="Intern\'s explanation"><i class="fa-regular fa-comment mr-1 text-sky-500"></i><strong class="text-slate-600">' + esc(r.note.type) + ':</strong> ' + esc(r.note.reason) + '</div>';
    const absentReview = (r) => !r.review ? (r.note ? '<button data-pf-act="att-excuse" data-date="' + r.date + '" class="text-[10.5px] font-semibold text-emerald-700 hover:text-emerald-800">Excuse</button><button data-pf-act="att-keep" data-date="' + r.date + '" class="ml-2 text-[10.5px] font-semibold text-slate-500 hover:text-slate-700">Keep absent</button>' : '')
        : '<span class="text-[10.5px] font-semibold ' + (r.review === 'excused' ? 'text-emerald-700' : 'text-slate-500') + '">' + (r.review === 'excused' ? 'Excused' : 'Kept absent') + '</span><button data-pf-act="att-undo" data-date="' + r.date + '" class="ml-2 text-[10.5px] text-slate-400 hover:text-slate-600">Undo</button>';
    const review = (r) => r.status === 'Absent' ? absentReview(r) : !(p.databaseRecord ? ['Flagged','Outside schedule','Late'].includes(r.status) : r.status==='Flagged') ? ''
        : !r.review ? '<button data-pf-act="att-accept" data-date="' + r.date + '" class="text-[10.5px] font-semibold text-emerald-700 hover:text-emerald-800">Accept</button><button data-pf-act="att-reject" data-date="' + r.date + '" class="ml-2 text-[10.5px] font-semibold text-red-600 hover:text-red-700">Reject</button>'
        : '<span class="text-[10.5px] font-semibold ' + (r.review === 'accepted' ? 'text-emerald-700' : 'text-red-600') + '">' + (r.review === 'accepted' ? 'Accepted' : 'Rejected') + '</span><button data-pf-act="att-undo" data-date="' + r.date + '" class="ml-2 text-[10.5px] text-slate-400 hover:text-slate-600">Undo</button>';
    const rows = shown.map(r => {
        const absent = r.status === 'Absent' || r.status === 'Holiday';
        const where = r.status === 'Holiday' ? '<span class="text-violet-700">' + esc(r.place) + '</span>' : absent ? '—' : r.remote ? '<span class="text-slate-600">' + r.place + '</span>'
            : '<div class="text-slate-600">' + esc(r.place) + '</div><div class="text-[10.5px] ' + (r.dist > (r.radius || GEOFENCE_M) ? 'text-red-500' : 'text-slate-400') + '">' + (r.dist > (r.radius || GEOFENCE_M) ? 'Outside geofence · ' : 'Inside geofence · ') + r.dist + ' m</div>';
        return '<tr' + (r.status === 'Flagged' && !r.review ? ' class="bg-red-50/40"' : r.status === 'Absent' && r.note && !r.review ? ' class="bg-amber-50/40"' : '') + '>'
          + '<td class="px-3 py-2 text-[12px] text-slate-700 whitespace-nowrap">' + formatDate(r.date) + '<div class="text-[10.5px] text-slate-400">' + new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'short'}) + '</div></td>'
          + '<td class="px-3 py-2">' + (absent ? '<span class="text-[12px] text-slate-400">—</span>' : photo(r, 'in')) + '</td>'
          + '<td class="px-3 py-2">' + (absent || r.timeOut == null ? '<span class="text-[12px] text-slate-400">—</span>' : '<span class="text-[12px] text-slate-700">' + fmtClock(r.timeOut) + '</span>') + '</td>'
          + '<td class="px-3 py-2 text-[12px]">' + where + '</td>'
          + '<td class="px-3 py-2 text-[12px] font-medium whitespace-nowrap ' + (r.review === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-700') + '">' + (r.status === 'Holiday' ? '—' : r.hours + ' hrs') + (r.review === 'rejected' ? '<div class="text-[10px] font-normal text-red-500 no-underline">not counted</div>' : '') + '</td>'
          + '<td class="px-3 py-2"><span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + ATT_BADGE[r.status] + '">' + r.status + '</span>' + noteHtml(r) + '</td>'
          + '<td class="px-3 py-2 whitespace-nowrap">' + review(r) + '</td></tr>';
    }).join('');
    const table = '<div class="overflow-x-auto -mx-1"><table class="w-full text-left"><thead><tr class="text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-200">'
        + '<th class="px-3 py-2 font-semibold">Date</th><th class="px-3 py-2 font-semibold">Time in</th><th class="px-3 py-2 font-semibold">Time out</th><th class="px-3 py-2 font-semibold">Location</th><th class="px-3 py-2 font-semibold">Hours</th><th class="px-3 py-2 font-semibold">Status</th><th class="px-3 py-2 font-semibold"></th>'
        + '</tr></thead><tbody class="divide-y divide-slate-100">' + (rows || '<tr><td colspan="7" class="px-3 py-6 text-center text-[12.5px] text-slate-400">No records match this filter.</td></tr>') + '</tbody></table></div>'
        + (list.length > 10 ? '<div class="text-center mt-2"><button data-pf-act="att-all" class="text-[11.5px] font-semibold text-sky-600 hover:text-sky-700">' + (attShowAll ? 'Show latest 10' : 'Show all ' + list.length + ' days') + '</button></div>' : '')
        + '<p class="text-[11px] text-slate-400 mt-3"><i class="fa-solid fa-shield-halved mr-1"></i>Checked at clock-in and clock-out: GPS against the ' + siteFor(p).radius + ' m company geofence, server timestamp, and a live camera photo (gallery uploads are not accepted). Location is not tracked in between. Photos and GPS stay with the OJT record for 5 years after completion. Holidays are set on the Attendance page and are not counted as absences; rejected clock-ins are not counted in the hours. Signed DTR scans are under Requirements.</p>';
    return wrap(summary + table, right);
}
function scheduleCard(p, deployed){
    if(!deployed) return '';
    const sc = scheduleOf(p);
    const row = (label, value) => '<div class="flex justify-between gap-3 py-1.5 text-[12.5px]"><span class="text-slate-500">' + label + '</span><span class="text-slate-800 text-right">' + value + '</span></div>';
    return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div class="flex items-center justify-between mb-2"><div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Schedule</div>'
        + (p.status === 'Completed' ? '' : '<button data-pf-act="schedule" class="text-[11.5px] font-semibold text-sky-600 hover:text-sky-700"><i class="fa-solid fa-pen mr-1"></i>Edit</button>') + '</div>'
        + '<div class="divide-y divide-slate-100">' + row('Work days', sc.days.map(d => DAY_NAMES[d]).join(', ')) + row('Hours', fmtClock(clockMins(sc.timeIn)) + ' – ' + fmtClock(clockMins(sc.timeOut)))
        + row('Late after', fmtClock(clockMins(sc.timeIn) + sc.grace) + ' <span class="text-slate-400">(' + sc.grace + ' min grace)</span>') + row('Work setup', sc.mode) + '</div></div>';
}
function showClockPhoto(p, date, kind){
    const r = internAttendance(p).find(x => x.date === date);
    if(!r) return;
    const lat = kind === 'out' && r.latOut ? r.latOut : r.lat;
    const lng = kind === 'out' && r.lngOut ? r.lngOut : r.lng;
    const distance = kind === 'out' && r.distOut != null ? r.distOut : r.dist;
    const row = (label, value) => '<div class="flex justify-between gap-3 py-1.5 text-[12.5px]"><span class="text-slate-500">' + label + '</span><span class="text-slate-800 text-right">' + value + '</span></div>';
    document.getElementById('attPhotoTitle').textContent = (kind === 'in' ? 'Clock-in' : 'Clock-out') + ' · ' + formatDate(date);
    document.getElementById('attPhotoBody').innerHTML = '<div class="flex gap-4">'
        + '<img src="' + clockPhoto(p, r, kind) + '" alt="Live camera photo" class="w-32 h-40 rounded-lg object-cover border border-slate-200 flex-shrink-0">'
        + '<div class="flex-1 min-w-0 divide-y divide-slate-100">'
        + row('Intern', esc(p.name))
        + row('Recorded time', formatDate(date) + ' ' + fmtClock(kind === 'in' ? r.timeIn : r.timeOut))
        + row('Photo', 'Live camera capture')
        + row('Location', r.remote ? 'Remote (work from home)' : esc(r.place))
        + row('GPS', lat && lng ? '<a target="_blank" rel="noopener" class="text-sky-600 hover:underline" href="https://www.google.com/maps?q=' + lat + ',' + lng + '">' + lat + ', ' + lng + '</a>' : 'Not recorded')
        + row('Geofence', r.remote ? 'Not required (remote day)' : distance > (r.radius || GEOFENCE_M) ? '<span class="text-red-600 font-medium">Outside · ' + distance + ' m away</span>' : '<span class="text-emerald-700 font-medium">Inside · ' + distance + ' m away</span>')
        + row('Hours that day', r.hours + ' hrs')
        + '</div></div>';
    openModal(document.getElementById('attPhotoModal'));
}
function exportInternAttendancePdf(p){
    const Pdf = window.jspdf?.jsPDF;
    if(!Pdf) return showToast('The PDF library could not load. Please try again.', 'warn');
    const doc = new Pdf({unit:'pt', format:'a4', orientation:'landscape'});
    if(typeof doc.autoTable !== 'function') return showToast('The PDF library could not load. Please try again.', 'warn');
    const rows = internAttendance(p).slice().reverse().map(r => [r.date,
        r.timeIn ? fmtClock(r.timeIn) : '', r.timeOut ? fmtClock(r.timeOut) : '',
        r.place || '', r.lat ?? '', r.lng ?? '', r.dist ?? '', r.hours, r.status, r.review || '']);
    const startY = drawExportHeader(doc, 'Student Attendance', [p.name,
        'Batch: ' + activeClassCode() + '  |  Generated ' + todayISO()], 40);
    doc.autoTable({startY, margin:{left:40,right:40,bottom:40}, theme:'striped',
        head:[['Date','Time in','Time out','Location','Latitude','Longitude','Distance (m)','Hours','Status','Review']],
        body:rows.length ? rows : [['No attendance records.','','','','','','','','','']],
        styles:{fontSize:8,cellPadding:4}, headStyles:{fillColor:[15,23,42]}});
    doc.save('Attendance_' + fileSlug(p.name) + '.pdf');
}


const profileCard = (title, body) => '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-3">' + title + '</div>' + body + '</div>';

function renderProfile(name){
    const box = document.getElementById('internProfile');
    const p = placementList().find(x => x.name === name);
    if(!p){ box.innerHTML = profileCard('Intern', '<div class="text-[12.5px] text-slate-500">Student not found.</div>'); return; }
    const idx = PLACEMENT_STEPS.indexOf(p.status);
    const deployed = idx >= PLACEMENT_STEPS.indexOf('Deployed');
    const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const lastDate = (status) => { const h = (p.history || []).filter(x => x.status === status).pop(); return h ? formatDate(h.date) : ''; };
    const hint = p.status === 'Deployed' ? Math.max(0, REQUIRED_HOURS - (p.hours || 0)) + ' hours left before the OJT is complete.'
        : p.status === 'Completed' ? 'Completed. OJT records are kept until ' + retainUntil(((p.history || []).filter(x => x.status === 'Completed').pop() || {date: todayISO()}).date) + '.'
        : p.status === 'Hours complete' && hasDoc(p.company, p.name, 'Supervisor evaluation') ? 'The supervisor evaluation is in the vault. Mark the intern as completed in the Roster.'
        : NEXT_HINT[p.status] || '';

    const header = '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center gap-4">'
      + '<div class="w-12 h-12 rounded-full bg-sky-100 text-sky-700 font-semibold flex items-center justify-center">' + profilePictureContent(p) + '</div>'
      + '<div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><h1 class="text-lg font-bold text-slate-900">' + esc(p.name) + '</h1>' + placementBadge(p.status) + '</div>'
      + '<div class="text-[12.5px] text-slate-500 mt-0.5">' + [p.studentNo, p.company || 'No partner company yet'].filter(Boolean).map(esc).join(' · ') + '</div></div>'
      + '<div class="flex gap-2">'
      + (p.company ? '<button data-pf-act="files" class="text-[12px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-md transition"><i class="fa-solid fa-folder-open mr-1.5"></i>Files</button>' : '')
      + '<a href="' + pages.placements + '" class="text-[12px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-md transition"><i class="fa-solid fa-route mr-1.5"></i>Placements</a>'
      + '</div></div>';

    const steps = PLACEMENT_STEPS.slice(1).map((step, i) => {
        const n = i + 1, done = idx >= n, current = idx === n - 1 && p.status !== 'Withdrawn';
        return '<div class="flex flex-col items-center text-center">'
          + '<div class="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold ' + (done ? 'bg-sky-600 text-white' : current ? 'bg-white text-sky-700 ring-2 ring-sky-400' : 'bg-slate-100 text-slate-400') + '">'
          + (done ? '<i class="fa-solid fa-check"></i>' : n) + '</div>'
          + '<div class="text-[11.5px] font-medium mt-1.5 ' + (done || current ? 'text-slate-800' : 'text-slate-400') + '">' + step + '</div>'
          + '<div class="text-[10.5px] text-slate-400 h-4">' + (done ? lastDate(step) : '') + '</div></div>';
    }).join('');
    const progress = profileCard('Internship progress', '<div class="grid grid-cols-3 sm:grid-cols-6 gap-3">' + steps + '</div>'
      + (hint ? '<div class="mt-4 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2"><i class="fa-solid fa-arrow-right mr-1.5 text-sky-600"></i>' + esc(hint) + '</div>' : ''));

    const pct = Math.min(100, Math.round((p.hours || 0) / REQUIRED_HOURS * 100));
    const atRisk = internAtRisk(p);
    const hours = profileCard('Rendered hours', deployed
        ? '<div class="flex items-end justify-between mb-2"><div><span class="text-2xl font-bold text-slate-900">' + (p.hours || 0) + '</span><span class="text-[12.5px] text-slate-500"> / ' + REQUIRED_HOURS + ' hours</span></div>'
          + '<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ' + (atRisk ? 'text-red-600 bg-red-100' : 'text-emerald-700 bg-emerald-50') + '">' + (atRisk ? 'At-Risk' : 'On Track') + '</span></div>'
          + '<div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ' + (atRisk ? 'bg-red-500' : 'bg-sky-600') + '" style="width:' + pct + '%"></div></div>'
          + '<div class="text-[11.5px] text-slate-400 mt-2">Deployed ' + (lastDate('Deployed') || '—') + '</div>'
        : '<div class="text-[12.5px] text-slate-500">Attendance starts after deployment.</div>');

    const checks = getJSON(CHECKLIST_KEY, {});
    const docs = internDocs(p.company, p.name);
    const reqRows = REQUIREMENTS.map(([type, when]) => {
        const files = docs.filter(f => f.type === type);
        const verified = checks[p.name + '|' + type];
        const right = verified
            ? '<span class="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle-check mr-1"></i>Verified</span><button data-pf-act="unverify" data-type="' + esc(type) + '" class="ml-2 text-[10.5px] text-slate-400 hover:text-slate-600">Undo</button>'
            : files.length
              ? '<span class="text-[10.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Pending</span><button data-pf-act="verify" data-type="' + esc(type) + '" class="ml-2 text-[10.5px] font-semibold text-sky-600 hover:text-sky-700">Mark verified</button>'
              : '<span class="text-[10.5px] text-slate-400">Missing</span>' + (p.company ? '<button data-pf-act="files" class="ml-2 text-[10.5px] font-semibold text-sky-600 hover:text-sky-700">Upload</button>' : '');
        return '<div class="flex items-center justify-between gap-3 py-2.5"><div class="min-w-0"><div class="text-[12.5px] font-medium text-slate-800">' + type + '</div>'
          + '<div class="text-[11px] text-slate-400 truncate">' + (files.length ? esc(files[files.length - 1].name) : when) + '</div></div><div class="flex-shrink-0 flex items-center">' + right + '</div></div>';
    }).join('');
    const requirements = profileCard('Requirements (signed scans in the vault)', '<div class="divide-y divide-slate-100">' + reqRows + '</div>');

    const logs = allTaskIds().reduce((rows, id) => rows.concat(taskInfo(id).submissions.filter(sub => sub.name === p.name).map(sub => ({id, sub}))), []);
    const logBody = logs.length ? '<div class="divide-y divide-slate-100">' + logs.map(({id, sub}) =>
        '<a href="' + pages.taskdetail + '?task=' + encodeURIComponent(id) + '" class="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-md">'
        + '<div class="min-w-0"><div class="text-[12.5px] font-medium text-slate-800">' + esc(taskInfo(id).title) + '</div><div class="text-[11px] text-slate-400">' + esc(sub.meta.split(' · ')[0]) + gradeText(id, sub.name) + '</div></div>'
        + '<span class="text-[10.5px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ' + sub.statusClass + '">' + sub.status + '</span></a>').join('') + '</div>'
        : '<div class="text-[12.5px] text-slate-500">No logs submitted yet.</div>';

    const history = (p.history || []).slice().reverse();
    const timeline = profileCard('Timeline', history.length ? '<div class="space-y-3">' + history.map(h =>
        '<div class="flex gap-3"><div class="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0"></div><div><div class="text-[12.5px] text-slate-800"><span class="font-medium">' + esc(h.status) + '</span>' + (h.note ? ' · ' + esc(h.note) : '') + '</div>'
        + '<div class="text-[11px] text-slate-400">' + formatDate(h.date) + '</div></div></div>').join('') + '</div>' : '<div class="text-[12.5px] text-slate-500">No activity yet.</div>');

    const jobApps = Object.entries(getJSON('ic_job_apps', {})).flatMap(([key, apps]) => apps.filter(a => !a.internship && (a.name === p.name || key === (p.email || '').toLowerCase() || key === p.name.toLowerCase())).map(a => Object.assign({key}, a)));
    const jobsCard = jobApps.length ? profileCard('Job applications', '<div class="text-[11.5px] text-slate-400 mb-2">Set the status for partner companies that do not use the portal.</div><div class="divide-y divide-slate-100">' + jobApps.map(a =>
        '<div class="flex items-center justify-between gap-3 py-2"><div><div class="text-[12.5px] font-medium text-slate-800">' + esc(a.title) + '</div><div class="text-[11px] text-slate-400">' + esc(a.company) + ' · applied ' + formatDate(a.date) + (a.statusBy ? ' · updated by ' + esc(a.statusBy) : '') + '</div></div>'
        + jobStatusSelect(a.key, a.job, a.status && a.status !== 'Submitted' ? a.status : 'Pending') + '</div>').join('') + '</div>') : '';
    const deletion = getDeletionRequests().find(r => r.name === p.name && r.status === 'processed');
    const deletedNote = deletion ? '<div class="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[12.5px] text-slate-600"><i class="fa-solid fa-user-slash mr-1.5 text-slate-400"></i>Profile, resume and job-matching data were deleted on ' + formatDate(deletion.processedAt) + ' at the alumni\'s request. This OJT record is read-only and kept until ' + retainUntil(alumniCompletedAt(p)) + '.</div>' : '';
    box.innerHTML = header + deletedNote + progress + attendanceCard(p, deployed)
      + '<div class="grid lg:grid-cols-2 gap-4"><div class="space-y-4">' + hours + scheduleCard(p, deployed) + profileCard('Daily logs and reports', logBody) + '</div>'
      + '<div class="space-y-4">' + requirements + timeline + jobsCard + '</div></div>';
}

function initCoordinatorInternProfile(){
if(!document.getElementById('internProfile')) return;
    const profileName = new URLSearchParams(window.location.search).get('name') || '';
    renderProfile(profileName);
    document.getElementById('internProfile').addEventListener('change', (e) => {
        const s = e.target.closest('select[data-jobstatus]'); if(!s) return;
        setJobAppStatus(s.dataset.jobstatus, s.dataset.job, s.value, 'Coordinator');
        showToast('Application status set to ' + s.value + '.', 'success');
        renderProfile(profileName);
    });
    if(window.location.hash === '#attendance') document.getElementById('attendance')?.scrollIntoView();
    on('attPhotoClose', 'click', () => closeModal(document.getElementById('attPhotoModal')));
    on('profileBackBtn', 'click', () => { if(history.length > 1) history.back(); else goTo('attendance'); });
    document.getElementById('internProfile').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-pf-act]');
        if(!btn) return;
        const p = placementList().find(x => x.name === profileName);
        if(btn.dataset.pfAct === 'files'){ openInternFiles(p.company, p.name); return; }
        const act = btn.dataset.pfAct;
        if(act === 'schedule'){
            openScheduleModal(p, 'Edit schedule of ' + p.name, (sched) => {
                savePlacement(p.name, {schedule: sched});
                logAudit('Updated the schedule of ' + p.name + ' (' + scheduleText(sched) + ')');
                showToast('Schedule of ' + esc(p.name) + ' updated.', 'success');
                renderProfile(profileName);
            });
            return;
        }
        if(act.startsWith('att-')){
            if(act === 'att-photo'){ showClockPhoto(p, btn.dataset.date, btn.dataset.kind); return; }
            if(act === 'att-export'){ exportInternAttendancePdf(p); return; }
            if(act === 'att-filter'){ attFilter = btn.dataset.f; attShowAll = false; }
            if(act === 'att-all') attShowAll = !attShowAll;
            if(['att-accept', 'att-reject', 'att-excuse', 'att-keep', 'att-undo'].includes(act)){
                if(p.databaseRecord || p.databasePlacement){
                    const decision={'att-accept':'accepted','att-reject':'rejected','att-undo':''}[act];
                    if(decision===undefined) return showToast('This action is not available for recorded attendance.', 'warn');
                    btn.disabled=true;
                    try{
                        await window.ICCoordinatorApi.reviewAttendance({email:p.email,date:btn.dataset.date,decision});
                        cacheDatabaseAttendance((await window.ICCoordinatorApi.attendance()).attendance);
                        showToast('Attendance review saved.', 'success');
                        renderProfile(profileName);
                    }catch(error){showToast(error.message || 'Could not save attendance review.', 'warn');btn.disabled=false;}
                    return;
                }
                const reviews = getJSON(ATT_REVIEW_KEY, {});
                const key = p.name + '|' + btn.dataset.date, day = formatDate(btn.dataset.date);
                const RESULT = {
                    'att-accept': ['accepted', 'Accepted flagged clock-in', 'Clock-in on ' + day + ' accepted.', 'success', 'Verified'],
                    'att-reject': ['rejected', 'Rejected flagged clock-in', 'Clock-in on ' + day + ' rejected.', 'warn', 'Flagged'],
                    'att-excuse': ['excused', 'Excused the absence', day + ' marked as excused.', 'success', 'Verified'],
                    'att-keep': ['unexcused', 'Kept the absence', day + ' stays absent.', 'info', 'Flagged']
                };
                if(act === 'att-undo') delete reviews[key];
                else { const [val, verb, msg, tone, st] = RESULT[act]; reviews[key] = val; showToast(msg, tone); logAudit(verb + ' of ' + p.name + ' on ' + btn.dataset.date, st); }
                localStorage.setItem(ATT_REVIEW_KEY, JSON.stringify(reviews));
            }
            renderProfile(profileName);
            return;
        }
        const checks = getJSON(CHECKLIST_KEY, {});
        const key = p.name + '|' + btn.dataset.type;
        if(btn.dataset.pfAct === 'verify'){ checks[key] = todayISO(); logAudit('Verified the ' + btn.dataset.type.toLowerCase() + ' of ' + p.name, 'Verified'); showToast(esc(btn.dataset.type) + ' verified.', 'success'); }
        else delete checks[key];
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checks));
        renderProfile(profileName);
    });
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initInternProfile = initCoordinatorInternProfile;

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initInternProfile?.();
  }, { once: true });
})();
