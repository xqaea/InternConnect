/* ============ Classwork and Tasks ============ */

// Tasks are saved per batch (prototype storage: ic_tasks)
// [{id, classCode, title, instructions, dueDate, dueTime, maxPoints, repeat, template (file students fill in), attachments (supporting files), status: open|closed|archived, turnedIn, total, approvedLogs}]
const TASK_KEY = 'ic_tasks';
let databaseTaskRecords=[];
function cacheDatabaseTasks(tasks){databaseTaskRecords=tasks;}
let databaseReportRecords=[];
function cacheDatabaseReports(reports){databaseReportRecords=reports;}
function savedTaskSubmissions(){
    if(!(getJSON('ic_session',{}) || {}).databaseAccount) return getJSON(SUB_KEY,{});
    const out={};
    databaseReportRecords.forEach(report=>{(out[report.taskId] ||= []).push(report);});
    return out;
}
const TASK_SEED = [
    {id: 'week5', classCode: SEED_CODE, title: 'Week 5 Accomplishment Report', instructions: 'Submit your weekly summary covering Sept 15–19. Include hours rendered and key tasks completed.',
     dueDate: '2026-09-19', dueTime: '23:59', maxPoints: 100, repeat: 'Friday', template: 'Week5_Report_Template.docx', attachments: [], status: 'open', turnedIn: 62, total: 85, approvedLogs: 1},
    {id: 'midterm', classCode: SEED_CODE, title: 'Mid-term Self-Assessment Form', instructions: 'Reflect on your progress so far and identify areas for growth.',
     dueDate: '2026-09-12', dueTime: '23:59', maxPoints: 50, repeat: '', template: null, attachments: [], status: 'open', turnedIn: 85, total: 85, approvedLogs: 1}
];
const getAllTasks = () => {
    const students = {};   // students of each batch, counted once per call
    if((getJSON('ic_session',{}) || {}).databaseAccount) return databaseTaskRecords.map(task=>liveTaskCounts({...task},students));
    return (getJSON(TASK_KEY, null) || TASK_SEED.map(t => Object.assign({}, t)))
        .map(t => Object.assign({attachments: []}, t, {template: t.template !== undefined ? t.template : t.attachment}))
        .map(t => liveTaskCounts(t, students));
};
// The two sample tasks keep their sample numbers. Every other task counts the real submissions
// against the students who are in its batch right now (so students who join later are counted too).
function liveTaskCounts(t, students){
    if(t.databaseTask){
        const reports=databaseReportRecords.filter(report=>report.taskId===t.id);
        return {...t,turnedIn:reports.length,total:Math.max(classCounts(t.classCode).interns,reports.length),approvedLogs:reports.filter(r=>r.status==='Verified').length};
    }
    if(TASK_SEED.some(x => x.id === t.id)) return t;
    if(!(t.classCode in students)) students[t.classCode] = classCounts(t.classCode).interns;
    const turnedIn = new Set((getJSON(SUB_KEY, {})[t.id] || []).map(x => x.name)).size;
    return Object.assign(t, {turnedIn, total: Math.max(students[t.classCode], turnedIn)});
}
const saveAllTasks = (list) => localStorage.setItem(TASK_KEY, JSON.stringify(list));
const findTask = (id) => getAllTasks().find(t => t.id === id) || null;
function updateTask(id, patch){ saveAllTasks(getAllTasks().map(t => t.id === id ? Object.assign({}, t, patch) : t)); }
const TASK_STATUS = {
    open: ['Open', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
    closed: ['Submissions closed', 'text-slate-600 bg-slate-100 border-slate-200'],
    archived: ['Archived', 'text-amber-700 bg-amber-50 border-amber-200']
};


/* ============ Task Detail ============ */

// Task Data
const taskData = {
    week5: {
      title: 'Week 5 Accomplishment Report',
      instructions: 'Submit your weekly summary covering Sept 15–19. Include hours rendered and key tasks completed.',
      due: 'Due Sept 19, 11:59 PM',
      attachment: 'Week5_Report_Template.docx',
      count: '62 / 85 Turned In',
      submissions: [
        { name: 'Aiyu T.', meta: 'Sept 15, 2026 · 8 hours claimed · Brightpath Software', status: 'Pending Review', statusClass: 'text-amber-600 bg-amber-50 border-amber-200',
          raw: "Assisted my supervisor in fixing the database migration script.\n\n\t- Tested the user API endpoints\n\t- Fixed minor bugs in the login flow\n\t- Attended the daily stand-up meeting with the team",
          bullet: 'Assisted in database migration and performed API unit testing under supervisor guidance.' },
        { name: 'Leo A.', meta: 'Sept 15, 2026 · 8 hours claimed · Nova Retail Systems', status: 'Pending Review', statusClass: 'text-amber-600 bg-amber-50 border-amber-200',
          raw: "Refactored the authentication module.\n\n\t- Reviewed pull requests from teammates\n\t- Fixed a session timeout bug",
          bullet: 'Refactored authentication module and reviewed teammate pull requests.' },
        { name: 'Kaye P.', meta: 'Sept 15, 2026 · 7.5 hours claimed · Brightpath Software', status: 'Verified', statusClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          raw: "Helped with QA testing for the new release.\n\n\t- Logged 5 bugs in the tracker\n\t- Retested the fixed bugs",
          bullet: 'Contributed to QA testing for a new release, logging and verifying bug fixes.' }
      ]
    },
    midterm: {
      title: 'Mid-term Self-Assessment Form',
      instructions: 'Reflect on your progress so far and identify areas for growth.',
      due: 'Due Sept 12, 11:59 PM',
      attachment: null,
      count: '85 / 85 Turned In',
      submissions: [
        { name: 'Aiyu T.', meta: 'Sept 10, 2026 · Self-assessment · Brightpath Software', status: 'Verified', statusClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          raw: "In the first half of my OJT, I learned how to collaborate using Git.\n\n\t- Became more comfortable reading an existing codebase\n\t- Want to strengthen my documentation skills further",
          bullet: 'Completed mid-term self-assessment highlighting growth in version control collaboration.' }
      ]
    }
};
taskData.week5.maxPoints = 100;
taskData.midterm.maxPoints = 50;

// Accomplishment reports: students submit, the coordinator approves (pushed to the Verified Resume), returns or rejects
const SUB_KEY = 'ic_submissions';         // {taskId: [{name, raw, bullet, company, date, status}]}
const SUB_STATUS_KEY = 'ic_sub_status';   // coordinator decisions: {'taskId|name': {status, feedback, at}}
const SUB_CLASS = {'Pending Review': 'text-amber-600 bg-amber-50 border-amber-200', 'Verified': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Needs Revision': 'text-orange-700 bg-orange-50 border-orange-200', 'Rejected': 'text-red-600 bg-red-50 border-red-200'};
function taskSubmissions(id){
    if((getJSON('ic_session',{}) || {}).databaseAccount) return databaseReportRecords.filter(report=>report.taskId===id).map(report=>({...report,statusClass:SUB_CLASS[report.status]}));
    const saved = getJSON(SUB_KEY, {})[id] || [], st = getJSON(SUB_STATUS_KEY, {});
    const seed = ((taskData[id] || {}).submissions || []).filter(x => !saved.some(y => y.name === x.name));
    const due = ((getJSON(TASK_KEY, null) || TASK_SEED).find(x => x.id === id) || {}).dueDate;
    const isLate = (x) => !!(due && x.date && x.date > due);
    return seed.concat(saved.map(x => Object.assign({}, x, {late: isLate(x), meta: formatDate(x.date) + ' · ' + (x.company || 'Not placed') + (isLate(x) ? ' · Late' : '')}))).map(x => {
        const r = st[id + '|' + x.name], status = r ? r.status : x.status;
        return Object.assign({}, x, {status, feedback: r ? r.feedback : x.feedback, statusClass: SUB_CLASS[status] || x.statusClass});
    });
}
const allTaskIds = () => [...new Set(((getJSON('ic_session',{}) || {}).databaseAccount?databaseReportRecords.map(r=>r.taskId):Object.keys(taskData)).concat(getAllTasks().map(t => t.id)))];
// Prototype stand-in for the AI resume bullet: first line of the report, cleaned up
function draftBullet(raw){
    const line = (raw.split('\n').map(l => l.replace(/^[\s\-•*]+/, '').trim()).find(Boolean) || '').replace(/[.\s]+$/, '');
    return line ? line.charAt(0).toUpperCase() + line.slice(1, 160) + '.' : '';
}
async function reviewSubmission(id, sub, status, feedback){
    if(sub.databaseReport){
        try{
            await window.ICCoordinatorApi.reviewReport(id,{email:sub.email,version:sub.version,status,feedback:feedback || ''});
            cacheDatabaseReports((await window.ICCoordinatorApi.reports()).reports);
            return true;
        }catch(error){showToast(error.message || 'Could not save the review.', 'warn');return false;}
    }
    const st = getJSON(SUB_STATUS_KEY, {});
    st[id + '|' + sub.name] = {status, feedback: feedback || '', at: todayISO()};
    localStorage.setItem(SUB_STATUS_KEY, JSON.stringify(st));
    logAudit((status === 'Verified' ? 'Approved and pushed to Verified Resume: ' : status === 'Rejected' ? 'Rejected log: ' : 'Requested revision: ') + sub.name + ' · ' + taskInfo(id).title, status === 'Verified' ? 'Success' : status);
}

// Saved task details (edited in Classwork) on top of the sample submissions
function taskInfo(id){
    const base = Object.assign({maxPoints: 100}, (getJSON('ic_session',{}) || {}).databaseAccount?{title:databaseReportRecords.find(r=>r.taskId===id)?.taskTitle || ''}:taskData[id] || {}, {submissions: taskSubmissions(id)});
    const t = findTask(id);
    if(!t) return base;
    return Object.assign({}, base, {title: t.title, instructions: t.instructions, due: dueLabel(t), attachment: t.attachment,
        count: t.turnedIn + ' / ' + t.total + ' Turned In', maxPoints: t.maxPoints, status: t.status, template: t.template, attachments: t.attachments});
}

// Grades are saved per task and per student: { 'week5|Aiyu T.': { score, feedback } }
const gradeKey = (taskId, name) => taskId + '|' + name;
const getGrades = () => (getJSON('ic_session',{}) || {}).databaseAccount
    ? Object.fromEntries(databaseReportRecords.filter(report=>report.score!=null).map(report=>[gradeKey(report.taskId,report.email),{score:report.score,feedback:report.gradeFeedback}]))
    : getJSON('ic_grades', {});
function gradeText(taskId, name){
    const g = getGrades()[gradeKey(taskId, name)];
    return g ? ' · Graded ' + g.score + '/' + taskInfo(taskId).maxPoints : '';
}
const subLine = (taskId, sub) => sub.status + (sub.late ? ' · Late' : '') + gradeText(taskId, sub.databaseReport?sub.email:sub.name);
