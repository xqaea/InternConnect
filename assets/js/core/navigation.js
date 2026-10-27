// Page Names
const pages = {
    login: '../auth/login.html',
    forgotpw: '../auth/forgot-password.html',
    overview: '../coordinator/overview.html',
    classes: '../coordinator/classes.html',
    roster: '../coordinator/roster.html',
    requests: '../coordinator/requests.html',
    classwork: '../coordinator/classwork.html',
    taskdetail: '../coordinator/task-detail.html',
    attendance: '../coordinator/attendance.html',
    partners: '../coordinator/directory.html',
    audit: '../coordinator/audit.html',
    placements: '../coordinator/placements.html',
    intern: '../coordinator/intern.html',
    poverview: '../partner/overview.html',   // partner company portal
    pvault: '../partner/vault.html',
    ppostings: '../partner/postings.html'
};

// Student / Alumni pages live in pages/student/ (all paths are relative to the current page, which is always pages/<section>/).
const studentPages = {
    overview: '../student/overview.html',
    attendance: '../student/attendance.html',
    daylog: '../student/day-log.html',
    classwork: '../student/classwork.html',
    taskdetail: '../student/task-detail.html',
    resume: '../student/resume-builder.html',
    jobs: '../student/job-matching.html'
};

// Register Pages (per role, step 1 to 3)
const registerPages = {
    coordinator:    ['../auth/register-coordinator-1.html', '../auth/register-coordinator-2.html', '../auth/register-coordinator-3.html'],
    student:        ['../auth/register-student-1.html', '../auth/register-student-2.html', '../auth/register-student-3.html'],
    partnercompany: ['../auth/register-partner-1.html', '../auth/register-partner-2.html', '../auth/register-partner-3.html']
};


// Which role is this page for? (register pages have data-role on <body>, login uses the role switcher)
function currentRole(){
    if(document.body.dataset.role) return document.body.dataset.role;
    const active = document.querySelector('#roleSwitcher .role-btn.active');
    if(active) return active.dataset.role;
    if(document.getElementById('sidebar')) return 'coordinator';   // coordinator dashboard pages have a sidebar but no data-role
    return 'student';
}

// Turn a page key into a file name (register1/2/3 depend on the role)
function pageFor(key){
    const m = key.match(/^register([123])$/);
    if(m) return registerPages[currentRole()][m[1] - 1];
    if(currentRole() === 'student' && studentPages[key]) return studentPages[key];
    return pages[key];
}

// Go To Another Screen (each screen is now its own .html file)
// The toast is saved first so it can show up on the next page
function goTo(page, toastMessage, toastType){
    if(toastMessage){
        sessionStorage.setItem('pendingToast', JSON.stringify({message: toastMessage, type: toastType || 'info'}));
    }
    window.location.href = pageFor(page);
}
