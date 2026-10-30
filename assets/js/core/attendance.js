const ATT_BADGE = {
    'Present': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Late': 'text-amber-700 bg-amber-50 border-amber-200',
    'Absent': 'text-slate-500 bg-slate-100 border-slate-200',
    'Flagged': 'text-red-600 bg-red-50 border-red-200',
    'Outside schedule': 'text-indigo-700 bg-indigo-50 border-indigo-200',
    'Holiday': 'text-violet-700 bg-violet-50 border-violet-200',
    'Clocked in': 'text-sky-700 bg-sky-50 border-sky-200'
};

/* ============ Attendance and Progress ============ */

// Rows: every deployed intern (Deployed or Hours complete), same status as Placements and the Roster
// Interns who just started (0 hours) are not flagged yet
// Hours the intern should have rendered by today: scheduled hours per work day x work days since deployment (holidays skipped)
function expectedHours(p){
    if(!p.deployedAt) return null;
    const sc = scheduleOf(p), span = clockMins(sc.timeOut) - clockMins(sc.timeIn);
    const shift = Math.max(1, Math.round(span / 60) - (span > 300 ? 1 : 0));
    const off = new Set(getHolidays().map(h => h.date));
    const end = new Date(todayISO() + 'T00:00:00');
    let days = 0;
    for(const d = new Date(p.deployedAt + 'T00:00:00'); d < end; d.setDate(d.getDate() + 1)){
        if(sc.days.includes(d.getDay()) && !off.has(isoDate(d))) days++;
    }
    return Math.min(REQUIRED_HOURS, days * shift);
}
// At-risk = behind schedule: at least a week in and under 60% of the expected hours.
// Sample interns have no start date, so they keep the simple rule (under 40% of the target).
const internAtRisk = (p) => {
    if(p.status !== 'Deployed') return false;
    const exp = expectedHours(p);
    if(exp == null) return p.hours > 0 && p.hours / REQUIRED_HOURS < 0.4;
    return exp >= 40 && (p.hours || 0) < exp * 0.6;
};

// Real clock-ins from the student portal: ic_live_attendance {name: {date: {in, out, hours, photoIn, lat, lng, dist}}}
const LIVE_KEY = 'ic_live_attendance';
let databaseAttendanceRecords=[];
function cacheDatabaseAttendance(records){ databaseAttendanceRecords=records; }
const liveRecs = (name) => (getJSON('ic_session',{}) || {}).databaseAccount
    ? Object.fromEntries(databaseAttendanceRecords.filter(row=>row.name===name).map(row=>[row.date,{...row,in:row.timeIn,out:row.timeOut}]))
    : getJSON(LIVE_KEY, {})[name] || {};
const liveHours = (name) => Object.values(liveRecs(name)).reduce((t, r) => t + (r.hours || 0), 0);


/* ============ Intern attendance records (clock-in / clock-out) ============ */

// Each clock-in and clock-out has a live camera photo, a server timestamp and a GPS point checked against the company geofence.
// Prototype: records are generated from the intern's rendered hours. Coordinator reviews of flagged records are saved in ic_attendance_review.
const ATT_REVIEW_KEY = 'ic_attendance_review';
// The intern's own explanation of a flagged, late or absent day, shown to the coordinator before reviewing it
const ATT_NOTES_KEY = 'ic_att_notes';
const ATT_REASONS = ['Field work / off-site task', 'Sick', 'Emergency', 'Company-approved absence', 'GPS or phone issue', 'Other'];
const GEOFENCE_M = 150;
const WORK_MODE = {'Aiyu T.': 'Hybrid', 'Leo A.': 'On-site', 'Jomari D.': 'Remote', 'Kaye P.': 'On-site'};
const COMPANY_SITES = {
    'Brightpath Software': {lat: 14.32940, lng: 120.93670, place: 'Brightpath Software, Dasmariñas'},
    'Verano Digital Studio': {lat: 14.45900, lng: 120.95700, place: 'Verano Digital Studio, Bacoor'},
    'Nova Retail Systems': {lat: 14.41100, lng: 120.94000, place: 'Nova Retail Systems, Imus'},
    'Cavite Provincial IT Office': {lat: 14.28200, lng: 120.86700, place: 'Provincial Capitol, Trece Martires'}
};
// Office location and geofence radius are set by the coordinator per company (ic_sites); an intern's branch can override it
const SITES_KEY = 'ic_sites';
function companySite(company){
    return Object.assign({lat: 14.33, lng: 120.94, place: company, radius: 150}, COMPANY_SITES[company] || {}, getJSON(SITES_KEY, {})[company] || {});
}
function siteFor(p){
    const own = (p.schedule || {}).site;
    return own ? Object.assign({}, companySite(p.company), own) : companySite(p.company);
}
// Accepts "14.3294, 120.9367" or a Google Maps link (…@14.32,120.93… or …?q=14.32,120.93…)
function parseCoords(text){
    const m = String(text || '').match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    return m ? {lat: Number(m[1]), lng: Number(m[2])} : null;
}
const mapsLink = (site) => 'https://www.google.com/maps?q=' + site.lat + ',' + site.lng;
const RADIUS_OPTIONS = [50, 100, 150, 200, 300, 500];
function seededRandom(text){
    let a = 0;
    for(const c of text) a = (Math.imul(31, a) + c.charCodeAt(0)) | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const isoDate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// Work schedule of a deployed intern, set by the coordinator at deployment (partners may update it if they use the portal)
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function scheduleOf(p){ return Object.assign({days: [1, 2, 3, 4, 5], timeIn: '08:00', timeOut: '17:00', grace: 15, mode: WORK_MODE[p.name] || 'On-site'}, p.schedule || {}); }
function clockMins(t){ return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }
function scheduleText(sc){ return sc.days.map(d => DAY_NAMES[d]).join(', ') + ' · ' + fmtClock(clockMins(sc.timeIn)) + ' – ' + fmtClock(clockMins(sc.timeOut)); }
const fmtClock = (mins) => { if(mins == null) return '—'; const h = Math.floor(mins / 60), m = mins % 60; return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };

// Newest first. Weekdays only, going back from the last working day until the rendered hours are used up.
function internAttendance(p){
    if(p.databaseRecord || p.databasePlacement) return databaseAttendanceRecords.filter(row=>row.email.toLowerCase()===(p.email || '').toLowerCase());
    const live = liveRecs(p.name);
    let left = (p.rawHours != null ? p.rawHours : (p.hours || 0)) - Object.values(live).reduce((t, r) => t + (r.hours || 0), 0);
    if((left <= 0 && !Object.keys(live).length) || !p.company) return [];
    const rand = seededRandom(p.name + '|' + p.company);
    const site = siteFor(p);
    const sched = scheduleOf(p), mode = sched.mode, start = clockMins(sched.timeIn), end = clockMins(sched.timeOut);
    const shift = Math.max(1, Math.round((end - start) / 60) - (end - start > 300 ? 1 : 0));
    const ended = (p.history || []).filter(h => h.status === 'Hours complete').pop();
    const day = new Date((ended ? ended.date : todayISO()) + 'T00:00:00');
    if(!ended) day.setDate(day.getDate() - 1);
    const reviews = getJSON(ATT_REVIEW_KEY, {});
    const off = Object.fromEntries(getHolidays().map(h => [h.date, h.name]));
    const out = [];
    for(let guard = 0; left > 0 && guard < 500; guard++, day.setDate(day.getDate() - 1)){
        const onSchedule = sched.days.includes(day.getDay());
        if(off[isoDate(day)]){ if(onSchedule) out.push({date: isoDate(day), status: 'Holiday', hours: 0, place: off[isoDate(day)]}); continue; }
        if(!onSchedule && !(day.getDay() === 6 && rand() < 0.06)) continue;
        const date = isoDate(day), r = rand();
        if(onSchedule && r < 0.05){ out.push({date, status: 'Absent', hours: 0, review: reviews[p.name + '|' + date] || ''}); continue; }
        const hours = Math.min(shift, left);
        left -= hours;
        const remote = mode === 'Remote' || (mode === 'Hybrid' && rand() < 0.4);
        const flagged = !remote && r < 0.09;
        const late = !flagged && r > 0.88;
        const timeIn = late ? start + sched.grace + 1 + Math.floor(rand() * 30) : start - 20 + Math.floor(rand() * 18);
        const timeOut = timeIn + hours * 60 + (hours > 4 ? 60 : 0) + Math.floor(rand() * 10);
        const dist = remote ? null : flagged ? site.radius + 250 + Math.floor(rand() * 900) : Math.floor(rand() * Math.min(120, site.radius * 0.8));
        const ang = rand() * Math.PI * 2, d = dist || 0;
        const lat = (site.lat + d / 111320 * Math.cos(ang)).toFixed(5);
        const lng = (site.lng + d / (111320 * Math.cos(site.lat * Math.PI / 180)) * Math.sin(ang)).toFixed(5);
        out.push({date, timeIn, timeOut, hours, lat, lng, dist, remote, radius: site.radius, place: remote ? 'Remote (work from home)' : site.place,
            status: !onSchedule ? 'Outside schedule' : flagged ? 'Flagged' : late ? 'Late' : 'Present', review: reviews[p.name + '|' + date] || (flagged && p.status === 'Completed' ? 'accepted' : '')});
    }
    const liveOut = Object.keys(live).sort().reverse().map(date => {
        const l = live[date], onSched = sched.days.includes(new Date(date + 'T00:00:00').getDay()), remote = mode === 'Remote';
        const status = l.out == null ? 'Clocked in' : !onSched ? 'Outside schedule' : !remote && (l.dist > site.radius || l.distOut > site.radius) ? 'Flagged' : l.in > start + sched.grace ? 'Late' : 'Present';
        return {date, timeIn: l.in, timeOut: l.out, hours: l.hours || 0, lat: l.lat, lng: l.lng, dist: remote ? null : l.dist, latOut: l.latOut, lngOut: l.lngOut, distOut: remote ? null : l.distOut, remote, live: true, photoIn: l.photoIn, photoOut: l.photoOut,
            radius: site.radius, place: remote ? 'Remote (work from home)' : site.place, status, review: reviews[p.name + '|' + date] || ''};
    });
    const notes = getJSON(ATT_NOTES_KEY, {});
    return liveOut.concat(out.filter(r => !live[r.date])).map(r => Object.assign(r, {note: notes[p.name + '|' + r.date] || null}));
}
const rejectedHours = (p) => internAttendance(p).filter(r => r.review === 'rejected').reduce((t, r) => t + r.hours, 0);
const pendingFlags = (p) => internAttendance(p).filter(r => r.status === 'Flagged' && !r.review).length;
const pendingExcuses = (p) => internAttendance(p).filter(r => r.status === 'Absent' && r.note && !r.review).length;

// Placeholder for the live camera capture, stamped with the server time and GPS point
function clockPhoto(p, rec, kind){
    if(rec.live && (kind === 'out' ? rec.photoOut : rec.photoIn)) return kind === 'out' ? rec.photoOut : rec.photoIn;
    if(rec.live) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><rect width="120" height="150" fill="#f1f5f9"/><text x="60" y="78" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">No photo</text></svg>');
    const rand = seededRandom(p.name + rec.date + kind);
    const bg = Math.floor(rand() * 360), shirt = Math.floor(rand() * 360), skin = 55 + Math.floor(rand() * 20);
    const stamp = formatDate(rec.date) + ' ' + fmtClock(kind === 'in' ? rec.timeIn : rec.timeOut);
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 150'>"
      + "<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='hsl(" + bg + ",25%,82%)'/><stop offset='1' stop-color='hsl(" + bg + ",20%,62%)'/></linearGradient></defs>"
      + "<rect width='120' height='150' fill='url(#g)'/><path d='M14 150 Q60 80 106 150Z' fill='hsl(" + shirt + ",35%,42%)'/>"
      + "<circle cx='60' cy='62' r='24' fill='hsl(28,45%," + skin + "%)'/><path d='M35 60 a25 25 0 0 1 50 0 q-25 -12 -50 0Z' fill='#2b2118'/>"
      + "<rect y='126' width='120' height='24' fill='rgba(0,0,0,.55)'/><text x='5' y='137' font-size='7.5' fill='#fff' font-family='Arial'>" + stamp + "</text>"
      + "<text x='5' y='146' font-size='6.5' fill='#ddd' font-family='Arial'>" + rec.lat + ', ' + rec.lng + "</text></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
