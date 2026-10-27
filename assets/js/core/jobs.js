/* ============ Job Matching: scores come from the saved Resume Builder skills, applications live in ic_job_apps ============ */
const JOB_SEED={
    'qa-brightpath':{course:'BSCS',title:'Junior QA & Documentation Intern',company:'Brightpath Software',score:'94% match',type:'Internship · Hybrid',location:'Dasmariñas, Cavite · 2.5 km away',salary:'₱3,500 / month OJT allowance',description:'Assist the QA team in testing software releases and maintaining internal documentation for ongoing projects.',requirements:['Currently enrolled in BS Computer Science or related program','Basic understanding of SQL and relational databases','Willing to work in a hybrid setup (2 days onsite per week)','Good written communication skills for documentation'],skills:[['SQL',true],['Documentation',true],['Agile',false]],deadline:'Application deadline: Oct 10, 2026'},
    'fe-verano':{course:'BSCS',title:'Front-End Developer',company:'Verano Digital Studio',score:'81% match',type:'Full-time · Remote',location:'Remote · 5.8 km from campus',salary:'₱18,000 – ₱22,000 / month',description:'Build and maintain client-facing web interfaces, working closely with designers to implement responsive layouts.',requirements:['Graduate of BS Computer Science or related program','Proficient in HTML, CSS, and JavaScript','Familiarity with design tools (Figma or similar) is a plus','Can work independently in a remote setup'],skills:[['Canva',true],['Figma',false],['HTML/CSS',true]],deadline:'Application deadline: Oct 15, 2026'},
    'fd-cavitegrand':{course:'BSHM',title:'Front Desk & Guest Relations Associate',company:'Cavite Grand Hotel',score:'73% match',type:'Part-time · Onsite',location:'Dasmariñas, Cavite · 3.1 km away',salary:'₱430 / day + meal allowance',description:'Handle guest check-in/check-out, respond to guest concerns, and support front office operations during shift hours.',requirements:['Currently enrolled in BS Hospitality Management','Pleasing personality and strong communication skills','Willing to work on a part-time shifting schedule, including weekends','Basic computer literacy (MS Office, booking systems)'],skills:[['Customer Service',true],['Events Coordination',false]],deadline:'Application deadline: Oct 5, 2026'}
};
// Partners post jobs (ic_postings); the samples above are starting postings their company can edit or close
const POSTINGS_KEY = 'ic_postings';
function allPostings(){
    const out = {};
    Object.keys(JOB_SEED).forEach(id => { out[id] = Object.assign({id, status: 'open', postedAt: '2026-09-15'}, JOB_SEED[id]); });
    Object.entries(getJSON(POSTINGS_KEY, {})).forEach(([id, p]) => { out[id] = Object.assign({}, out[id] || {}, p, {id}); });
    return out;
}
const jobDetails = Object.fromEntries(Object.entries(allPostings()).filter(([, j]) => j.status !== 'closed' && partnerCompanies().includes(j.company)));
const JOB_APPS_KEY = 'ic_job_apps';
const PROGRAM_COURSE = {'BS Computer Science': 'BSCS', 'BS Hospitality Management': 'BSHM', 'BS Business Administration': 'BSBA'};
const JM_DEFAULT_SKILLS = ['Communication', 'Python', 'SQL', 'Canva'];
const jmKey = (me) => ((me || {}).email || (me || {}).name || '').toLowerCase();
const isInternshipJob = (job) => /^Internship/.test(job.type);
const JOB_OPEN = ['Pending', 'Applied', 'Endorsed', 'Accepted'];
function jmSkills(me){
    const r = getJSON('ic_resume', {})[jmKey(me)];
    const registered = getUsers().some(u => u.role === 'student' && u.email?.toLowerCase() === jmKey(me));
    return (r?.savedAt ? (r.soft || []).concat(r.hard || []) : registered ? [] : JM_DEFAULT_SKILLS).map(x => x.toLowerCase());
}
// 40% course fit + 60% share of the job's skills found in the student's resume
function jobMatch(job, me){
    const have = jmSkills(me), skills = job.skills.map(([n]) => [n, have.includes(n.toLowerCase())]);
    const courseOk = job.course === (PROGRAM_COURSE[(me || {}).program] || 'BSCS');
    return {score: Math.round((courseOk ? 40 : 0) + 60 * skills.filter(x => x[1]).length / (skills.length || 1)), skills, courseOk};
}
function myJobApps(me){ return getJSON(JOB_APPS_KEY, {})[jmKey(me)] || []; }
function jobStatusSelect(key, job, cur){
    return '<select data-jobstatus="' + esc(key) + '" data-job="' + esc(job) + '" class="border border-slate-300 rounded-md px-2 py-1 text-[11.5px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400">'
      + ['Pending', 'Accepted', 'Not Selected'].map(s => '<option' + (s === cur ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>';
}
function jobBadge(st){
    return '<span class="text-[11px] font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ' + ({Accepted: 'text-emerald-700 bg-emerald-50 border-emerald-200', 'Not Selected': 'text-rose-700 bg-rose-50 border-rose-200'}[st] || 'text-amber-700 bg-amber-50 border-amber-200') + '">' + st + '</span>';
}
// Job applications (alumni): the partner sets the status, or the coordinator on its behalf when the partner does not use the portal
function setJobAppStatus(key, jobId, status, by){
    const all = getJSON(JOB_APPS_KEY, {}), a = (all[key] || []).find(x => x.job === jobId && !x.internship);
    if(!a) return;
    Object.assign(a, {status, statusAt: todayISO(), statusBy: by});
    localStorage.setItem(JOB_APPS_KEY, JSON.stringify(all));
    logAudit('Set the application of ' + (a.name || key) + ' for ' + a.title + ' to ' + status, 'Success');
}
function jobAppStatus(a, me){
    if(!a.internship) return a.status && a.status !== 'Submitted' ? a.status : 'Pending';
    const p = placementList().find(x => x.name === me.name || (me.email && x.email === me.email));
    return p && p.company === a.company && p.status !== 'Not placed' ? p.status : 'Cancelled';
}
const jmApplied = (id, me) => myJobApps(me).some(a => a.job === id && !['Cancelled', 'Withdrawn'].includes(jobAppStatus(a, me)));
