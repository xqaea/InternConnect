// Page Names
const pages = {
    login: 'InternConnectLogin.html',
    forgotpw: 'InternConnectForgotPassword.html',
    overview: 'CoordinatorOverview.html',
    classes: 'CoordinatorClasses.html',
    roster: 'CoordinatorRoster.html',
    requests: 'CoordinatorRequests.html',
    classwork: 'CoordinatorClasswork.html',
    taskdetail: 'CoordinatorTaskDetail.html',
    attendance: 'CoordinatorAttendance.html',
    partners: 'CoordinatorDirectory.html',
    audit: 'CoordinatorAudit.html',
    placements: 'CoordinatorPlacements.html',
    intern: 'CoordinatorIntern.html'
};

// Student / Alumni pages live beside the coordinator pages in the main project folder.
const studentPages = {
    overview: 'StudentOverview.html',
    attendance: 'StudentAttendance.html',
    daylog: 'StudentDayLog.html',
    classwork: 'StudentClasswork.html',
    taskdetail: 'StudentTaskDetail.html',
    resume: 'StudentResumeBuilder.html',
    jobs: 'StudentJobMatching.html'
};

// Register Pages (per role, step 1 to 3)
const registerPages = {
    coordinator:    ['InternConnectCoordinatorRegister1.html', 'InternConnectCoordinatorRegister2.html', 'InternConnectCoordinatorRegister3.html'],
    student:        ['InternConnectStudentRegister1.html', 'InternConnectStudentRegister2.html', 'InternConnectStudentRegister3.html'],
    partnercompany: ['InternConnectPartnerRegister1.html', 'InternConnectPartnerRegister2.html', 'InternConnectPartnerRegister3.html']
};

// Where each role lands after login (key from "pages" above, null = dashboard not built yet)
const dashboards = { coordinator: 'overview', student: 'overview', partnercompany: null };
const roleLabels = { student: 'Student', coordinator: 'Coordinator', partnercompany: 'Industry Partner' };

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

// Toast Notification
function showToast(message, type){
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icons = {success:'fa-circle-check', warn:'fa-triangle-exclamation', info:'fa-circle-info'};
    el.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

// Add Event Listener Only If The Element Exists On This Page
function on(id, eventName, handler){
    const el = document.getElementById(id);
    if(el) el.addEventListener(eventName, handler);
}

// Go To Another Screen (each screen is now its own .html file)
// The toast is saved first so it can show up on the next page
function goTo(page, toastMessage, toastType){
    if(toastMessage){
        sessionStorage.setItem('pendingToast', JSON.stringify({message: toastMessage, type: toastType || 'info'}));
    }
    window.location.href = pageFor(page);
}

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
const isStudentPortal = !!sidebar && document.body.dataset.role === 'student';   // student pages have their own sidebar code (Student / Alumni Portal section at the bottom)
const overlay = document.getElementById('overlay');
const mobileToggle = document.getElementById('mobileToggle');
const mainFooter = document.getElementById('mainFooter');

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

if(sidebar && !isStudentPortal){
    // Nav Links (go to the matching page, logout goes back to login)
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            if(btn.dataset.tab === 'logout'){
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
    notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifDropdown.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if(!notifDropdown.contains(e.target)) notifDropdown.classList.add('hidden'); });
}

// Export Buttons
document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const label = btn.textContent.trim();
        showToast('Preparing "' + label + '" your download will start shortly.', 'info');
    });
});


/* ============ Accounts and Themes (prototype "database" in localStorage) ============ */

// users   = every registered account (role, email, password, program, theme...)
// classes = class code -> { program, theme } (created by the coordinator at sign up)
const getUsers = () => getJSON('ic_users', []);
const saveUsers = (list) => localStorage.setItem('ic_users', JSON.stringify(list));
const getClasses = () => Object.assign({'PHINMA-CS-2026': {program: 'BS Computer Science', theme: 'sky'}}, getJSON('ic_classes', {}));

// Sign In Draft (the data typed across register steps 1 to 3)
function getDraft(){ try { return JSON.parse(sessionStorage.getItem('ic_reg')) || {}; } catch(e){ return {}; } }
function saveDraft(patch){ sessionStorage.setItem('ic_reg', JSON.stringify(Object.assign(getDraft(), patch))); }

// Save who is logged in (theme included) then open their dashboard
function startSession(user, message){
    localStorage.setItem('ic_session', JSON.stringify({
        email: user.email, role: user.role, name: user.name, program: user.program,
        theme: user.theme, school: user.school || '', classCode: user.classCode || '',
        avatar: user.avatar || '', status: user.status || 'active', hours: Number(user.hours || user.ojtHours || 0),
        ojtHours: Number(user.ojtHours || user.hours || 0), completedAt: user.completedAt || '',
        company: user.company || '', studentNumber: user.studentNumber || ''
    }));
    applyTheme(user.theme);
    const dest = dashboards[user.role];
    if(dest) goTo(dest, message, 'success');
    else showToast((message ? message + ' ' : '') + 'The ' + roleLabels[user.role] + ' dashboard is not built yet.', 'info');
}


/* ============ Classes (batches) ============ */

// classes = { code: { program, theme, school, coordinator, term, status: active | closed | archived, createdAt } }
const SEED_CODE = 'PHINMA-CS-2026';   // demo class used by the demo login
const REQUIRED_HOURS = 486;

function esc(text){
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML.replace(/"/g, '&quot;');
}
function todayISO(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatDate(iso){
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
}
// 5-year retention counted from the completion / withdrawal date
function retainUntil(iso){
    return formatDate(iso.replace(/^\d{4}/, y => String(Number(y) + 5)));
}

// Every batch of the logged-in coordinator (newest first)
function myClasses(){
    const me = getJSON('ic_session', null) || {};
    const all = getClasses();
    return Object.keys(all)
        .filter(code => all[code].coordinator === me.email || (code === SEED_CODE && me.classCode === SEED_CODE))
        .map(code => Object.assign({term: 'Initial batch', status: 'active', createdAt: '2026-01-01'}, all[code], {code}))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
// The batch the coordinator is working in right now (remembered in the browser)
function activeClassCode(){
    const list = myClasses();
    const me = getJSON('ic_session', null) || {};
    const saved = localStorage.getItem('ic_active_class');
    if(list.some(c => c.code === saved)) return saved;
    if(list.some(c => c.code === me.classCode)) return me.classCode;
    return list.length ? list[0].code : '';
}
function activeClass(){ return myClasses().find(c => c.code === activeClassCode()) || null; }
function setActiveClass(code){ localStorage.setItem('ic_active_class', code); }
function updateClass(code, patch){
    const stored = getJSON('ic_classes', {});
    stored[code] = Object.assign({}, getClasses()[code], patch);
    localStorage.setItem('ic_classes', JSON.stringify(stored));
}
function updateUser(email, role, patch){
    saveUsers(getUsers().map(u => (u.email === email && u.role === role) ? Object.assign({}, u, patch) : u));
}
function classCounts(code){
    if(code === SEED_CODE) return {interns: 85, alumni: 12};   // demo numbers, same as the Overview
    const members = getUsers().filter(u => u.role === 'student' && u.classCode === code);
    return {
        interns: members.filter(u => ['intern', 'alumni_pending'].includes(u.status || 'intern')).length,
        alumni: members.filter(u => u.status === 'alumni').length
    };
}
function memberTotal(code){
    return getUsers().filter(u => u.classCode === code && u.role !== 'coordinator').length;
}
function refreshHeaderCode(){
    const code = activeClassCode();
    if(code) document.querySelectorAll('[data-user="classcode"]').forEach(el => el.textContent = code);
}
const STATUS_BADGE = {
    active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    closed: 'text-amber-700 bg-amber-50 border-amber-200',
    archived: 'text-slate-500 bg-slate-100 border-slate-200'
};
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function openModal(el){ el.classList.remove('hidden'); el.classList.add('flex'); }
function closeModal(el){ el.classList.add('hidden'); el.classList.remove('flex'); }


/* ============ Login ============ */

// Role Switcher
document.querySelectorAll('#roleSwitcher .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#roleSwitcher .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('roleLabel').textContent = roleLabels[btn.dataset.role];
    });
});

// Submit (registered accounts are checked, any other email + password still opens a demo account)
on('loginSubmitBtn', 'click', () => {
    const role = currentRole();
    const email = document.getElementById('loginEmail').value.trim();
    const pw = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginError');
    const user = getUsers().find(u => u.role === role && u.email.toLowerCase() === email.toLowerCase());
    if(!pw || (user && user.password !== pw)){
        errorBox.classList.remove('hidden');
        errorBox.classList.add('flex');
        return;
    }
    errorBox.classList.add('hidden');
    if(user && user.status === 'pending'){
        return showToast('Your request to join the class is still waiting for coordinator approval.', 'warn');
    }
    const demo = {role, email: email || 'demo@sjc.edu.ph', name: 'Demo User', program: 'BS Computer Science', theme: 'sky', school: 'PHINMA SJCDC', classCode: 'PHINMA-CS-2026'};
    if(role === 'student') Object.assign(demo, {name: 'Alex V. Santos', status: 'intern', hours: 320, ojtHours: 320});
    startSession(user || demo);
});

// Links To Other Screens
on('goToRegisterLink', 'click', () => {
    sessionStorage.removeItem('ic_reg');
    saveDraft({role: currentRole()});
    goTo('register1');
});
on('forgotPasswordLink', 'click', () => goTo('forgotpw'));
on('goToLoginLink', 'click', () => goTo('login'));
on('backToLoginFromForgot', 'click', () => goTo('login'));

// Forgot Password
on('sendResetLinkBtn', 'click', () => {
    document.getElementById('forgotPwSent').classList.remove('hidden');
    document.getElementById('forgotPwSent').classList.add('flex');
});


/* ============ Register (same code for Coordinator, Student and Partner) ============ */

// Put Back What Was Typed Before (when pressing the back arrow)
(function restoreDraft(){
    const draft = getDraft();
    document.querySelectorAll('input[id^="reg"], select[id^="reg"]').forEach(el => {
        const key = el.id.slice(3);
        if(el.type !== 'file' && draft[key] && key !== 'Code') el.value = draft[key];
    });
    const preview = document.getElementById('avatarPreview');
    if(preview && draft.avatar){
        preview.src = draft.avatar;
        preview.classList.remove('hidden');
        document.getElementById('avatarIcon').classList.add('hidden');
    }
})();

// Read every field of a step (ids that start with "reg"), also tells which ones are empty
function collect(sectionId){
    const data = {}, empty = [];
    document.querySelectorAll('#' + sectionId + ' input[id^="reg"], #' + sectionId + ' select[id^="reg"]').forEach(el => {
        if(el.type === 'file') return;
        const v = el.value.trim();
        data[el.id.slice(3)] = v;
        if(!v) empty.push(el);
    });
    return {data, empty};
}

// Step 1: Profile Picture (resized to 128px so it is small enough to store)
on('avatarInput', 'change', function(){
    const file = this.files[0];
    if(!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const side = Math.min(img.width, img.height);
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        const preview = document.getElementById('avatarPreview');
        preview.src = data;
        preview.classList.remove('hidden');
        document.getElementById('avatarIcon').classList.add('hidden');
        saveDraft({avatar: data});
    };
    img.src = url;
});

// Step 1: Back / Next
on('regBack1', 'click', () => goTo('login'));
on('regNext1', 'click', () => {
    const {data, empty} = collect('tab-register1');
    document.getElementById('regStep1Error').classList.toggle('hidden', empty.length === 0);
    if(empty.length) return;
    saveDraft(Object.assign(data, {role: currentRole()}));
    goTo('register2');
});

// Step 2: Back / Send Code / Resend / Next
on('regBack2', 'click', () => goTo('register1'));
on('sendCodeBtn', 'click', () => {
    const email = document.getElementById('regEmail').value.trim();
    if(!email) return showToast('Enter your email first.', 'warn');
    showToast('Confirmation code sent to ' + email, 'info');
});
on('resendCodeLink', 'click', () => showToast('A new code was sent to your email.', 'info'));
// Show a red message right above the arrows (easier to notice than a toast)
function showStep2Error(message){
    let box = document.getElementById('regStep2Error');
    if(!box){
        box = document.createElement('p');
        box.id = 'regStep2Error';
        box.className = 'text-[11.5px] text-red-600';
        document.getElementById('regNext2').parentElement.before(box);
    }
    box.innerHTML = message ? '<i class="fa-solid fa-circle-exclamation mr-1"></i>' + message : '';
}

on('regNext2', 'click', () => {
    const email = document.getElementById('regEmail').value.trim();
    const pw = document.getElementById('regPassword').value;
    const pwConfirm = document.getElementById('regPasswordConfirm').value;
    const code = document.getElementById('regCode').value.trim();
   const passwordValid =
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw);

const mismatch = !pw || pw !== pwConfirm;

document.getElementById('regPasswordMismatch').classList.toggle(
    'hidden',
    !mismatch
);

document.getElementById('codeError').classList.toggle(
    'hidden',
    code.length >= 6
);

showStep2Error('');

if (!passwordValid) {
    return showStep2Error(
        'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.'
    );
}
    showStep2Error('');
    if(!email) return showStep2Error('Enter your email first.');
    if(getUsers().some(u => u.role === currentRole() && u.email.toLowerCase() === email.toLowerCase())){
        return showStep2Error('This email is already registered. Use a different email, or sign in instead.');
    }
    if(!passwordValid || mismatch || code.length < 6) return;
    saveDraft({Email: email, Password: pw});
    goTo('register3');
});

// Step 3 (Coordinator): Theme Picker — the whole screen changes color live
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        document.getElementById('themeChosenLabel').textContent = {emerald:'Green selected', rose:'Red selected', sky:'Blue selected'}[dot.dataset.theme];
        applyTheme(dot.dataset.theme);
    });
});
const activeDot = document.querySelector('.theme-dot.active');
if(activeDot) applyTheme(activeDot.dataset.theme);

// Step 3 (Student / Partner): typing a valid class code previews the coordinator's theme
on('regClassCode', 'input', function(){
    if(document.querySelector('.theme-dot')) return;   // coordinators pick their own theme
    const found = getClasses()[this.value.trim()];
    applyTheme(found ? found.theme : 'sky');
});

// Step 3: Back / Generate Class Code
on('regBack3', 'click', () => goTo('register2'));
on('generateCodeBtn', 'click', () => {
    const program = getDraft().Program || '';
    const prefix = programShort(program) || 'OJT';
    const code = prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    document.getElementById('regClassCode').value = code;
    showToast('Class code generated: ' + code, 'success');
});

// Step 3: Sign Up
// Coordinator -> creates the class (code + program + theme)
// Student / Partner -> code must exist AND be for the same program, then they inherit its theme
on('enterDashboardBtn', 'click', () => {
    const role = currentRole();
    const draft = getDraft();
    const code = document.getElementById('regClassCode').value.trim();
    if(!draft.Email) { goTo('register1'); return; }   // skipped the earlier steps
    if(!code) return showToast(role === 'coordinator' ? 'Generate or type a class code first.' : 'Enter your class code first.', 'warn');

    const all = getClasses();
    let theme, school = '';
    if(role === 'coordinator'){
        if(all[code]) return showToast('That class code is already in use.', 'warn');
        theme = document.querySelector('.theme-dot.active').dataset.theme;
        school = draft.SchoolName;
        const classes = getJSON('ic_classes', {});
        classes[code] = {program: draft.Program, theme, school: draft.SchoolName, coordinator: draft.Email,
                         term: 'Initial batch', status: 'active', createdAt: todayISO()};
        localStorage.setItem('ic_classes', JSON.stringify(classes));
    } else {
        const found = all[code];
        if(!found) return showToast('Invalid class code. Ask your coordinator for the correct one.', 'warn');
        if(found.program !== draft.Program) return showToast('This class code is for ' + found.program + ', not your program.', 'warn');
        theme = found.theme;
        school = found.school || '';
    }

    const user = {role, email: draft.Email, password: draft.Password, name: draft.FirstName + ' ' + draft.LastName,
                  program: draft.Program, theme, school, classCode: code, avatar: draft.avatar || '',
                  status: role === 'coordinator' ? 'active' : 'pending',   // students and partners wait for the coordinator
                  company: draft.CompanyName || '', studentNumber: draft.StudentNumber || ''};
    saveUsers(getUsers().concat(user));
    sessionStorage.removeItem('ic_reg');
    startSession(user, 'Account created. Welcome to InternConnect!');
});


/* ============ Dashboard Profile (coordinator pages) ============ */

const REQUIRE_LOGIN = true;   // set to false while designing, so pages open without signing in

// "BS Computer Science" -> "BSCS"
function programShort(program){
    const words = (program || '').split(/\s+/).filter(Boolean);
    return words[0] === 'BS' ? 'BS' + words.slice(1).map(w => w[0]).join('').toUpperCase() : (program || '');
}

if(sidebar){
    const me = getJSON('ic_session', null);
    if(!me || me.role !== (isStudentPortal ? 'student' : 'coordinator')){
        if(REQUIRE_LOGIN) goTo('login', 'Please sign in first.', 'warn');
    } else if(me.role === 'coordinator'){
        const parts = (me.name || '').trim().split(/\s+/);
        const initials = ((parts[0] || '')[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
        const values = {
            name: me.name,
            role: me.program ? programShort(me.program) + ' OJT Coordinator' : '',
            school: me.school,
            classcode: activeClassCode() || me.classCode
        };
        Object.keys(values).forEach(key => {
            if(!values[key]) return;   // keep the sample text when there is nothing saved
            document.querySelectorAll('[data-user="' + key + '"]').forEach(el => el.textContent = values[key]);
        });
        document.querySelectorAll('[data-user="avatar"]').forEach(el => {
            if(me.avatar){
                el.innerHTML = '';
                const img = document.createElement('img');
                img.src = me.avatar;
                img.alt = '';
                img.className = 'w-full h-full object-cover';
                el.appendChild(img);
            } else if(initials){
                el.textContent = initials.toUpperCase();
            }
        });
    }
}


/* ============ Overview ============ */

on('viewClassworkLink', 'click', () => goTo('classwork'));


/* ============ Requests (join requests and deletion requests) ============ */

// Sub Tabs (also used by the Batch Roster)
document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.subtab).classList.remove('hidden');
    });
});

// Real sign ups of the current batch show up on top of the sample cards
function pendingCard(u){
    const initials = (u.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const isStudent = u.role === 'student';
    const avatar = isStudent
        ? '<div class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-[12px] font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
        : '<div class="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><i class="fa-solid fa-building"></i></div>';
    const meta = isStudent ? esc(u.studentNumber || u.email) + ' · new sign up' : esc(u.company || u.name) + ' · ' + esc(u.email);
    return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3" data-email="' + esc(u.email) + '" data-userrole="' + u.role + '">'
      + '<div class="flex items-center gap-3">' + avatar + '<div><div class="font-semibold text-slate-900 text-sm">' + esc(isStudent ? u.name : (u.company || u.name)) + '</div><div class="text-[11.5px] text-slate-400">' + meta + '</div></div></div>'
      + '<div class="flex gap-2 flex-shrink-0">'
      + '<button class="join-approve text-[12px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-check mr-1"></i>Approve</button>'
      + '<button class="join-reject text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>'
      + '</div></div>';
}
function updateRequestCounts(){
    const count = (id) => document.querySelectorAll('#' + id + ' > .bg-white').length;
    document.getElementById('wrStudentsCount').textContent = '(' + count('wr-students') + ')';
    document.getElementById('wrPartnersCount').textContent = '(' + count('wr-partners') + ')';
    document.getElementById('wrDeletionsCount').textContent = '(' + count('wr-deletions') + ')';
}
if(document.getElementById('wr-students')){
    const code = activeClassCode();
    const pending = getUsers().filter(u => u.classCode === code && u.status === 'pending');
    pending.filter(u => u.role === 'student').forEach(u => document.getElementById('wr-students').insertAdjacentHTML('afterbegin', pendingCard(u)));
    pending.filter(u => u.role === 'partnercompany').forEach(u => document.getElementById('wr-partners').insertAdjacentHTML('afterbegin', pendingCard(u)));
    updateRequestCounts();
}

// Approve and Reject (approved students become Interns, rejected sign ups are deleted)
document.addEventListener('click', (e) => {
    const approve = e.target.closest('.join-approve');
    const reject = e.target.closest('.join-reject');
    if(!approve && !reject) return;
    const card = (approve || reject).closest('.bg-white');
    const name = card.querySelector('.font-semibold').textContent;
    const email = card.dataset.email, role = card.dataset.userrole;
    if(email){
        if(approve) updateUser(email, role, {status: role === 'student' ? 'intern' : 'active'});
        else saveUsers(getUsers().filter(u => !(u.email === email && u.role === role)));
    }
    card.remove();
    updateRequestCounts();
    if(approve) showToast(name + ' approved and added to the class.', 'success');
    else showToast(name + "'s request was rejected.", 'warn');
});

/* ============ Classwork and Tasks ============ */

// Tasks are saved per batch (prototype storage: ic_tasks)
// [{id, classCode, title, instructions, dueDate, dueTime, maxPoints, repeat, template (file students fill in), attachments (supporting files), status: open|closed|archived, turnedIn, total, approvedLogs}]
const TASK_KEY = 'ic_tasks';
const TASK_SEED = [
    {id: 'week5', classCode: SEED_CODE, title: 'Week 5 Accomplishment Report', instructions: 'Submit your weekly summary covering Sept 15–19. Include hours rendered and key tasks completed.',
     dueDate: '2026-09-19', dueTime: '23:59', maxPoints: 100, repeat: 'Friday', template: 'Week5_Report_Template.docx', attachments: [], status: 'open', turnedIn: 62, total: 85, approvedLogs: 1},
    {id: 'midterm', classCode: SEED_CODE, title: 'Mid-term Self-Assessment Form', instructions: 'Reflect on your progress so far and identify areas for growth.',
     dueDate: '2026-09-12', dueTime: '23:59', maxPoints: 50, repeat: '', template: null, attachments: [], status: 'open', turnedIn: 85, total: 85, approvedLogs: 1}
];
const getAllTasks = () => (getJSON(TASK_KEY, null) || TASK_SEED.map(t => Object.assign({}, t)))
    .map(t => Object.assign({attachments: []}, t, {template: t.template !== undefined ? t.template : t.attachment}));
const saveAllTasks = (list) => localStorage.setItem(TASK_KEY, JSON.stringify(list));
const findTask = (id) => getAllTasks().find(t => t.id === id) || null;
function updateTask(id, patch){ saveAllTasks(getAllTasks().map(t => t.id === id ? Object.assign({}, t, patch) : t)); }
// A task with submissions or approved logs is an OJT record: it can be archived but not deleted (5-year retention)
const taskLocked = (t) => t.turnedIn > 0 || t.approvedLogs > 0;

function dueLabel(t){
    if(!t.dueDate) return 'No due date';
    const [h, m] = (t.dueTime || '23:59').split(':').map(Number);
    const time = ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
    return 'Due ' + new Date(t.dueDate + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) + ', ' + time;
}
const repeatLabel = (r) => ['Friday', 'Monday'].includes(r) ? 'Repeats every ' + r : 'Repeats ' + r.charAt(0).toLowerCase() + r.slice(1);

const TASK_STATUS = {
    open: ['Open', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
    closed: ['Submissions closed', 'text-slate-600 bg-slate-100 border-slate-200'],
    archived: ['Archived', 'text-amber-700 bg-amber-50 border-amber-200']
};
const LOCKED_REASON = 'This task already has submissions, so it is kept as an OJT record for 5 years. Archive it instead.';

function taskMenuItem(act, icon, label, opts){
    opts = opts || {};
    const look = opts.blocked ? 'text-slate-300 cursor-not-allowed' : (opts.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50');
    return '<button data-task-act="' + act + '"' + (opts.blocked ? ' data-blocked="' + esc(opts.blocked) + '" title="' + esc(opts.blocked) + '"' : '')
      + ' class="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 ' + look + '"><i class="fa-solid ' + icon + ' w-3.5 text-center"></i>' + label + '</button>';
}
function taskCard(t){
    const status = TASK_STATUS[t.status] || TASK_STATUS.open;
    const done = t.turnedIn >= t.total;
    const del = taskMenuItem('delete', 'fa-trash', 'Delete', {danger: true, blocked: taskLocked(t) ? LOCKED_REASON : ''});
    const menu = t.status === 'archived'
        ? taskMenuItem('restore', 'fa-rotate-left', 'Restore') + del
        : taskMenuItem('edit', 'fa-pen', 'Edit') + taskMenuItem('duplicate', 'fa-copy', 'Duplicate')
          + (t.status === 'open' ? taskMenuItem('close', 'fa-lock', 'Close submissions') : taskMenuItem('reopen', 'fa-lock-open', 'Reopen submissions'))
          + taskMenuItem('archive', 'fa-box-archive', 'Archive') + del;
    return '<div data-task="' + esc(t.id) + '" class="task-card cursor-pointer bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-sky-300 transition' + (t.status === 'archived' ? ' opacity-80' : '') + '">'
      + '<div class="flex items-start justify-between gap-3"><div class="min-w-0">'
      + '<div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-slate-900 text-sm">' + esc(t.title) + '</span>'
      + (t.status !== 'open' ? '<span class="text-[10px] font-semibold border px-1.5 py-0.5 rounded-full ' + status[1] + '">' + status[0] + '</span>' : '') + '</div>'
      + (t.instructions ? '<p class="text-[12.5px] text-slate-500 mt-1">' + esc(t.instructions) + '</p>' : '')
      + '<div class="flex items-center gap-3 mt-2 text-[11.5px] text-slate-400 flex-wrap">'
      + '<span><i class="fa-regular fa-calendar mr-1"></i>' + dueLabel(t) + '</span>'
      + (t.repeat ? '<span><i class="fa-solid fa-rotate mr-1"></i>' + esc(repeatLabel(t.repeat)) + '</span>' : '')
      + (t.template ? '<span><i class="fa-regular fa-file-lines mr-1"></i>Template</span>' : '')
      + (t.attachments.length ? '<span><i class="fa-solid fa-paperclip mr-1"></i>' + t.attachments.length + ' attachment' + (t.attachments.length > 1 ? 's' : '') + '</span>' : '')
      + '<span><i class="fa-regular fa-star mr-1"></i>' + t.maxPoints + ' pts</span>'
      + '</div></div>'
      + '<div class="flex items-start gap-1.5 flex-shrink-0">'
      + '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border ' + (done ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-sky-700 bg-sky-50 border-sky-200') + '">' + t.turnedIn + ' / ' + t.total + ' Turned In</span>'
      + '<div class="relative"><button data-task-menu class="w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" title="More actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>'
      + '<div class="task-menu hidden absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">' + menu + '</div></div>'
      + '</div></div></div>';
}

let taskFilter = 'active';
function renderTasks(){
    const box = document.getElementById('taskList');
    if(!box) return;
    const mine = getAllTasks().filter(t => t.classCode === activeClassCode());
    const active = mine.filter(t => t.status !== 'archived');
    const archived = mine.filter(t => t.status === 'archived');
    document.getElementById('taskCountActive').textContent = '(' + active.length + ')';
    document.getElementById('taskCountArchived').textContent = '(' + archived.length + ')';
    document.querySelectorAll('.task-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === taskFilter));
    const list = taskFilter === 'archived' ? archived : active;
    box.innerHTML = list.map(taskCard).join('');
    const empty = document.getElementById('taskListEmpty');
    empty.textContent = taskFilter === 'archived' ? 'No archived tasks.' : 'No tasks yet. Click "Create New Task" to post one.';
    empty.classList.toggle('hidden', list.length > 0);
}
const closeTaskMenus = () => document.querySelectorAll('.task-menu').forEach(m => m.classList.add('hidden'));

// Create / Edit Task Modal
const taskModal = document.getElementById('taskModal');
let editingTaskId = null;
function openTaskModal(t){
    editingTaskId = t ? t.id : null;
    document.getElementById('taskModalTitle').textContent = t ? 'Edit Task' : 'Create New Task';
    document.getElementById('postTaskBtn').textContent = t ? 'Save Changes' : 'Post Task';
    document.getElementById('taskTitleInput').value = t ? t.title : '';
    document.getElementById('taskDescInput').value = t ? t.instructions : '';
    document.getElementById('taskDueDate').value = t ? (t.dueDate || '') : '';
    document.getElementById('taskDueTime').value = t ? (t.dueTime || '23:59') : '23:59';
    document.getElementById('taskMaxPoints').value = t ? t.maxPoints : 100;
    document.getElementById('taskTemplate').value = '';
    document.getElementById('taskAttachments').value = '';
    const tc = document.getElementById('taskTemplateCurrent');
    tc.classList.toggle('hidden', !(t && t.template));
    if(t && t.template) tc.innerHTML = 'Current template: ' + esc(t.template) + ' · choose a file to replace it';
    const ac = document.getElementById('taskAttachCurrent');
    ac.classList.toggle('hidden', !(t && t.attachments.length));
    if(t && t.attachments.length) ac.innerHTML = 'Current attachments: ' + esc(t.attachments.join(', ')) + ' · choosing files replaces them';
    const repeat = document.getElementById('repeatToggle');
    repeat.checked = !!(t && t.repeat);
    document.getElementById('taskRepeatSelect').value = (t && t.repeat) || 'Friday';
    document.getElementById('repeatIntervalRow').classList.toggle('hidden', !repeat.checked);
    document.getElementById('taskEditNote').classList.toggle('hidden', !(t && t.turnedIn > 0));
    taskModal.classList.remove('hidden');
}
on('openTaskModalBtn', 'click', () => openTaskModal(null));
on('closeTaskModalBtn', 'click', () => taskModal.classList.add('hidden'));
on('cancelTaskBtn', 'click', () => taskModal.classList.add('hidden'));
on('repeatToggle', 'change', function(){
    document.getElementById('repeatIntervalRow').classList.toggle('hidden', !this.checked);
});
on('postTaskBtn', 'click', () => {
    const title = document.getElementById('taskTitleInput').value.trim();
    if(!title){ showToast('Enter a task title.', 'warn'); return; }
    const maxPoints = Number(document.getElementById('taskMaxPoints').value);
    if(!(maxPoints > 0)){ showToast('Max points must be more than 0.', 'warn'); return; }
    const fields = {
        title, maxPoints,
        instructions: document.getElementById('taskDescInput').value.trim(),
        dueDate: document.getElementById('taskDueDate').value,
        dueTime: document.getElementById('taskDueTime').value || '23:59',
        repeat: document.getElementById('repeatToggle').checked ? document.getElementById('taskRepeatSelect').value : ''
    };
    const tpl = document.getElementById('taskTemplate').files;
    if(tpl.length) fields.template = tpl[0].name;
    const att = document.getElementById('taskAttachments').files;
    if(att.length) fields.attachments = [...att].map(f => f.name);
    if(editingTaskId){
        updateTask(editingTaskId, fields);
        showToast('"' + esc(title) + '" updated.', 'success');
    } else {
        const list = getAllTasks();
        list.unshift(Object.assign({id: 't' + Date.now().toString(36), classCode: activeClassCode(), attachment: null, status: 'open',
            turnedIn: 0, total: classCounts(activeClassCode()).interns, approvedLogs: 0, template: null, attachments: []}, fields));
        saveAllTasks(list);
        taskFilter = 'active';
        showToast('Task posted to your class stream.', 'success');
    }
    taskModal.classList.add('hidden');
    renderTasks();
});

// Task card menu: Edit, Duplicate, Close / Reopen, Archive / Restore, Delete
function taskAction(id, act){
    const t = findTask(id);
    if(!t) return;
    const name = '"' + esc(t.title) + '"';
    if(act === 'edit'){ openTaskModal(t); return; }
    if(act === 'duplicate'){
        const list = getAllTasks();
        list.splice(list.findIndex(x => x.id === id), 0, Object.assign({}, t, {id: 't' + Date.now().toString(36), title: t.title + ' (copy)', status: 'open', turnedIn: 0, approvedLogs: 0}));
        saveAllTasks(list);
        showToast('Copy created. Edit it to change the title or due date.', 'success');
    }
    if(act === 'close'){ updateTask(id, {status: 'closed'}); showToast('Submissions closed for ' + name + '. You can still review and grade.', 'info'); }
    if(act === 'reopen'){ updateTask(id, {status: 'open'}); showToast('Submissions reopened for ' + name + '.', 'success'); }
    if(act === 'archive'){
        if(!confirm('Archive "' + t.title + '"? Students will no longer see it. Submissions and grades are kept.')) return;
        updateTask(id, {status: 'archived'});
        showToast(name + ' archived. You can restore it from the Archived tab.', 'info');
    }
    if(act === 'restore'){ updateTask(id, {status: 'closed'}); taskFilter = 'active'; showToast(name + ' restored with submissions closed. Reopen it if students still need to submit.', 'success'); }
    if(act === 'delete'){
        if(!confirm('Delete "' + t.title + '"? This cannot be undone.')) return;
        saveAllTasks(getAllTasks().filter(x => x.id !== id));
        showToast(name + ' deleted.', 'warn');
    }
    renderTasks();
}

if(document.getElementById('taskList')){
    document.getElementById('taskList').addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if(!card) return;
        const menuBtn = e.target.closest('[data-task-menu]');
        if(menuBtn){
            e.stopPropagation();
            const menu = menuBtn.nextElementSibling;
            const show = menu.classList.contains('hidden');
            closeTaskMenus();
            menu.classList.toggle('hidden', !show);
            return;
        }
        const item = e.target.closest('[data-task-act]');
        if(item){
            e.stopPropagation();
            closeTaskMenus();
            if(item.dataset.blocked){ showToast(item.dataset.blocked, 'warn'); return; }
            taskAction(card.dataset.task, item.dataset.taskAct);
            return;
        }
        if(e.target.closest('.task-menu')) return;
        window.location.href = pages.taskdetail + '?task=' + encodeURIComponent(card.dataset.task);
    });
    document.addEventListener('click', closeTaskMenus);
    document.querySelectorAll('.task-filter').forEach(b => b.addEventListener('click', () => { taskFilter = b.dataset.filter; renderTasks(); }));
    renderTasks();
    const editId = new URLSearchParams(window.location.search).get('edit');
    if(editId && findTask(editId)) openTaskModal(findTask(editId));
}


// Batch Selector (switches the current batch)
function updateBatchBadge(){
    const cls = activeClass();
    const badge = document.getElementById('batchStatusBadge');
    if(!cls || !badge) return;
    badge.textContent = capitalize(cls.status);
    badge.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[cls.status];
}
if(document.getElementById('batchSelect')){
    const sel = document.getElementById('batchSelect');
    const active = activeClassCode();
    sel.innerHTML = myClasses().filter(c => c.status !== 'archived').map(c =>
        '<option value="' + esc(c.code) + '"' + (c.code === active ? ' selected' : '') + '>' + esc(c.term) + ' · ' + esc(c.code) + '</option>').join('');
    updateBatchBadge();
    sel.addEventListener('change', () => {
        setActiveClass(sel.value);
        refreshHeaderCode();
        updateBatchBadge();
        renderTasks();
        showToast('Switched to ' + sel.options[sel.selectedIndex].text + '.', 'info');
    });
}


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
          raw: "Tinulungan ko si Sir mag-fix ng database migration script.\n\n\t- Tinest ang user API endpoints\n\t- Nag-ayos ng minor bugs sa login flow\n\t- Nag-attend ng stand-up meeting kasama ang team",
          bullet: 'Assisted in database migration and performed API unit testing under supervisor guidance.' },
        { name: 'Leo A.', meta: 'Sept 15, 2026 · 8 hours claimed · Nova Retail Systems', status: 'Pending Review', statusClass: 'text-amber-600 bg-amber-50 border-amber-200',
          raw: "Nag-refactor ng authentication module.\n\n\t- Na-review yung pull requests ng teammates\n\t- Nag-fix ng session timeout bug",
          bullet: 'Refactored authentication module and reviewed teammate pull requests.' },
        { name: 'Kaye P.', meta: 'Sept 15, 2026 · 7.5 hours claimed · Brightpath Software', status: 'Verified', statusClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          raw: "Tumulong sa QA testing ng bagong release.\n\n\t- Nag-log ng 5 bugs sa tracker\n\t- Nag-retest ng mga naayos na bug",
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
          raw: "Sa unang kalahati ng OJT ko, natutunan ko kung paano mag-collaborate gamit ang Git.\n\n\t- Naging mas komportable ako sa pagbasa ng existing codebase\n\t- Gusto kong palakasin pa yung documentation skills ko",
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
    const saved = getJSON(SUB_KEY, {})[id] || [], st = getJSON(SUB_STATUS_KEY, {});
    const seed = ((taskData[id] || {}).submissions || []).filter(x => !saved.some(y => y.name === x.name));
    return seed.concat(saved.map(x => Object.assign({}, x, {meta: formatDate(x.date) + ' · ' + (x.company || 'Not placed')}))).map(x => {
        const r = st[id + '|' + x.name], status = r ? r.status : x.status;
        return Object.assign({}, x, {status, feedback: r ? r.feedback : x.feedback, statusClass: SUB_CLASS[status] || x.statusClass});
    });
}
const allTaskIds = () => [...new Set(Object.keys(taskData).concat(getAllTasks().map(t => t.id)))];
// Prototype stand-in for the AI resume bullet: first line of the report, cleaned up
function draftBullet(raw){
    const line = (raw.split('\n').map(l => l.replace(/^[\s\-•*]+/, '').trim()).find(Boolean) || '').replace(/[.\s]+$/, '');
    return line ? line.charAt(0).toUpperCase() + line.slice(1, 160) + '.' : '';
}
function reviewSubmission(id, sub, status, feedback){
    const st = getJSON(SUB_STATUS_KEY, {});
    st[id + '|' + sub.name] = {status, feedback: feedback || '', at: todayISO()};
    localStorage.setItem(SUB_STATUS_KEY, JSON.stringify(st));
    logAudit((status === 'Verified' ? 'Approved and pushed to Verified Resume: ' : status === 'Rejected' ? 'Rejected log: ' : 'Requested revision: ') + sub.name + ' · ' + taskInfo(id).title, status === 'Verified' ? 'Success' : status);
}

// Saved task details (edited in Classwork) on top of the sample submissions
function taskInfo(id){
    const base = Object.assign({maxPoints: 100}, taskData[id] || {}, {submissions: taskSubmissions(id)});
    const t = findTask(id);
    if(!t) return base;
    return Object.assign({}, base, {title: t.title, instructions: t.instructions, due: dueLabel(t), attachment: t.attachment,
        count: t.turnedIn + ' / ' + t.total + ' Turned In', maxPoints: t.maxPoints, status: t.status, template: t.template, attachments: t.attachments});
}

// Grades are saved per task and per student: { 'week5|Aiyu T.': { score, feedback } }
const gradeKey = (taskId, name) => taskId + '|' + name;
const getGrades = () => getJSON('ic_grades', {});
function gradeText(taskId, name){
    const g = getGrades()[gradeKey(taskId, name)];
    return g ? ' · Graded ' + g.score + '/' + taskInfo(taskId).maxPoints : '';
}

let currentTaskId = 'week5';
let currentSubIndex = 0;

// Show One Submission On The Right Side
function renderSubmissionDetail(taskId, index){
    const sub = taskInfo(taskId).submissions[index];
    document.getElementById('subDetailName').textContent = sub.name;
    document.getElementById('subDetailMeta').textContent = sub.meta;
    const statusEl = document.getElementById('subDetailStatus');
    statusEl.textContent = sub.status;
    statusEl.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-full border ' + sub.statusClass;
    document.getElementById('subDetailRaw').textContent = sub.raw;
    document.getElementById('subDetailBullet').textContent = sub.bullet;
    currentSubIndex = index;
    const g = getGrades()[gradeKey(taskId, sub.name)];
    document.getElementById('gradeInput').value = g ? g.score : '';
    document.getElementById('gradeFeedback').value = g ? g.feedback : '';
    document.getElementById('gradeMax').textContent = taskInfo(taskId).maxPoints;
}

// Fill In The Whole Task Detail Screen
function renderTaskDetail(taskId){
    const t = taskInfo(taskId);
    currentTaskId = taskId;
    document.getElementById('taskDetailTitle').textContent = t.title;
    document.getElementById('taskDetailInstructions').textContent = t.instructions;
    document.getElementById('taskDetailDue').innerHTML = '<i class="fa-regular fa-calendar mr-1"></i>' + t.due;
    document.getElementById('taskDetailCount').textContent = t.count;
    const attEl = document.getElementById('taskDetailAttachment');
    if(t.template){
      attEl.style.display = '';
      attEl.innerHTML = '<i class="fa-regular fa-file-lines mr-1"></i>Template: <a href="#" class="text-sky-600 hover:underline">' + esc(t.template) + '</a>';
    } else {
      attEl.style.display = 'none';
    }
    const alEl = document.getElementById('taskDetailAttachList');
    alEl.classList.toggle('hidden', !(t.attachments && t.attachments.length));
    if(t.attachments && t.attachments.length) alEl.innerHTML = '<i class="fa-solid fa-paperclip mr-1"></i>Attachments: ' + esc(t.attachments.join(', '));
    // Submissions List (left side)
    const list = document.getElementById('taskSubmissionsList');
    list.innerHTML = '';
    t.submissions.forEach((sub, i) => {
      const item = document.createElement('div');
      item.className = 'log-item border rounded-lg px-3 py-2.5 cursor-pointer ' + (i === 0 ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50');
      item.innerHTML = '<div class="text-[12.5px] font-semibold text-slate-900">' + sub.name + '</div><div class="text-[10.5px] text-slate-400">' + sub.status + gradeText(taskId, sub.name) + '</div>';
      item.addEventListener('click', () => {
        document.querySelectorAll('#taskSubmissionsList .log-item').forEach(el => { el.classList.remove('border-sky-300','bg-sky-50'); el.classList.add('border-slate-200'); });
        item.classList.remove('border-slate-200'); item.classList.add('border-sky-300','bg-sky-50');
        renderSubmissionDetail(taskId, i);
      });
      list.appendChild(item);
    });
    const statusEl = document.getElementById('taskDetailStatus');
    const status = t.status && t.status !== 'open' ? TASK_STATUS[t.status] : null;
    statusEl.classList.toggle('hidden', !status);
    if(status){ statusEl.textContent = status[0]; statusEl.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + status[1]; }
    const hasSubs = t.submissions.length > 0;
    document.getElementById('taskSplit').classList.toggle('hidden', !hasSubs);
    document.getElementById('taskNoSubs').classList.toggle('hidden', hasSubs);
    if(hasSubs) renderSubmissionDetail(taskId, 0);
}

// Load The Task From The Link (taskdetail.html?task=week5)
if(document.getElementById('taskSubmissionsList')){
    const taskFromLink = new URLSearchParams(window.location.search).get('task');
    renderTaskDetail(taskFromLink && (findTask(taskFromLink) || taskData[taskFromLink]) ? taskFromLink : 'week5');
}

on('backToClassworkBtn', 'click', () => goTo('classwork'));
on('td-editTaskBtn', 'click', () => { window.location.href = pages.classwork + '?edit=' + encodeURIComponent(currentTaskId); });

// Approve, Revise, Reject and Export Buttons
function afterReview(){
    const i = currentSubIndex;
    renderTaskDetail(currentTaskId);
    document.querySelectorAll('#taskSubmissionsList .log-item').forEach((el, k) => { el.classList.toggle('border-sky-300', k === i); el.classList.toggle('bg-sky-50', k === i); el.classList.toggle('border-slate-200', k !== i); });
    renderSubmissionDetail(currentTaskId, i);
}
on('td-approveBtn', 'click', () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    reviewSubmission(currentTaskId, sub, 'Verified', document.getElementById('gradeFeedback').value.trim());
    afterReview();
    showToast(sub.name + "'s log approved and pushed to verified resume.", 'success');
});
on('td-reviseBtn', 'click', () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    const fb = prompt('What should ' + sub.name + ' revise? The student will see this.', document.getElementById('gradeFeedback').value.trim());
    if(!fb || !fb.trim()) return;
    reviewSubmission(currentTaskId, sub, 'Needs Revision', fb.trim());
    afterReview();
    showToast('Revision requested — ' + sub.name + ' will be notified.', 'warn');
});
on('td-rejectBtn', 'click', () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    const fb = prompt('Why is ' + sub.name + "'s log rejected? The student will see this.");
    if(!fb || !fb.trim()) return;
    reviewSubmission(currentTaskId, sub, 'Rejected', fb.trim());
    afterReview();
    showToast('Log rejected.', 'warn');
});
on('td-saveGradeBtn', 'click', () => {
    const t = taskInfo(currentTaskId);
    const sub = t.submissions[currentSubIndex];
    const raw = document.getElementById('gradeInput').value;
    const score = Number(raw);
    if(raw === '' || isNaN(score) || score < 0 || score > t.maxPoints){
        return showToast('Enter a grade from 0 to ' + t.maxPoints + '.', 'warn');
    }
    const grades = getGrades();
    grades[gradeKey(currentTaskId, sub.name)] = {score, feedback: document.getElementById('gradeFeedback').value.trim()};
    localStorage.setItem('ic_grades', JSON.stringify(grades));
    const item = document.querySelectorAll('#taskSubmissionsList .log-item')[currentSubIndex];
    if(item) item.lastChild.textContent = sub.status + gradeText(currentTaskId, sub.name);
    showToast('Grade saved: ' + sub.name + ' got ' + score + '/' + t.maxPoints + '.', 'success');
});
on('td-genPdfBtn', 'click', () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    showToast('Generating PDF of ' + sub.name + "'s accomplishment report...", 'info');
});
on('td-genWordBtn', 'click', () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    showToast('Generating Word document of ' + sub.name + "'s accomplishment report...", 'info');
});


/* ============ Classes Page ============ */

function renderClasses(){
    const box = document.getElementById('classList');
    if(!box) return;
    const showArchived = document.getElementById('showArchived').checked;
    const active = activeClassCode();
    const list = myClasses().filter(c => showArchived || c.status !== 'archived');
    if(!list.length){
        box.innerHTML = '<p class="text-[12.5px] text-slate-400 col-span-full">No batches yet. Create your first batch.</p>';
        return;
    }
    box.innerHTML = list.map(c => {
        const n = classCounts(c.code);
        const isCurrent = c.code === active;
        const btn = 'text-[11.5px] font-semibold px-3 py-1.5 rounded-md transition ';
        return '<div class="bg-white rounded-xl border ' + (isCurrent ? 'border-sky-300' : 'border-slate-200') + ' shadow-sm p-4">'
          + '<div class="flex items-start justify-between gap-2">'
          +   '<div><div class="font-semibold text-slate-900 text-sm">' + esc(c.term) + '</div>'
          +   '<div class="text-[11.5px] text-slate-400 mt-0.5">' + esc(c.program || '') + '</div></div>'
          +   '<div class="flex items-center gap-1.5 flex-shrink-0">'
          +     (isCurrent ? '<span class="text-[10.5px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">Current</span>' : '')
          +     '<span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[c.status] + '">' + capitalize(c.status) + '</span>'
          +   '</div></div>'
          + '<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">'
          +   '<span><i class="fa-solid fa-user-graduate mr-1 text-slate-400"></i>' + n.interns + ' interns</span>'
          +   '<span><i class="fa-solid fa-medal mr-1 text-slate-400"></i>' + n.alumni + ' alumni</span>'
          +   '<span class="text-slate-500"><i class="fa-solid fa-hashtag mr-1 text-slate-400"></i>' + esc(c.code) + '</span>'
          + '</div>'
          + '<div class="mt-3 flex flex-wrap gap-2">'
          +   '<button data-act="open" data-code="' + esc(c.code) + '" class="' + btn + 'text-white bg-slate-900 hover:bg-slate-800">Open roster</button>'
          +   (isCurrent ? '' : '<button data-act="current" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Set as current</button>')
          +   (c.status === 'closed' && n.interns === 0 ? '<button data-act="archive" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Archive</button>' : '')
          +   '<button data-act="rename" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Rename</button>'
          +   (c.code !== SEED_CODE && memberTotal(c.code) === 0 ? '<button data-act="delete" data-code="' + esc(c.code) + '" class="' + btn + 'text-red-600 bg-red-50 hover:bg-red-100">Delete</button>' : '')
          +   (c.status === 'archived' ? '<button data-act="restore" data-code="' + esc(c.code) + '" class="' + btn + 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Restore</button>' : '')
          + '</div></div>';
    }).join('');
}

if(document.getElementById('classList')){
    renderClasses();
    on('showArchived', 'change', renderClasses);

    document.getElementById('classList').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if(!btn) return;
        const code = btn.dataset.code;
        if(btn.dataset.act === 'open'){ setActiveClass(code); goTo('roster'); return; }
        if(btn.dataset.act === 'current'){ setActiveClass(code); showToast('Current batch changed to ' + code + '.', 'info'); }
        if(btn.dataset.act === 'archive'){ updateClass(code, {status: 'archived'}); showToast('Batch archived. Its records are kept.', 'info'); }
        if(btn.dataset.act === 'restore'){ updateClass(code, {status: 'closed'}); showToast('Batch restored.', 'info'); }
        if(btn.dataset.act === 'rename'){ openBatchModal(code); return; }
        if(btn.dataset.act === 'delete'){
            if(myClasses().length <= 1) return showToast('You need at least one batch. Create another one first.', 'warn');
            if(!confirm('Delete this empty batch? This cannot be undone.')) return;
            const stored = getJSON('ic_classes', {});
            delete stored[code];
            localStorage.setItem('ic_classes', JSON.stringify(stored));
            showToast('Batch deleted.', 'info');
        }
        refreshHeaderCode();
        renderClasses();
    });

    // Create New Batch
    const batchModal = document.getElementById('batchModal');
    let editingCode = null;   // null = creating a new batch, otherwise the code being renamed
    function openBatchModal(code){
        editingCode = code || null;
        const cls = code ? myClasses().find(c => c.code === code) : null;
        document.getElementById('batchModalTitle').textContent = cls ? 'Rename Batch' : 'Create New Batch';
        document.getElementById('batchModalNote').classList.toggle('hidden', !!cls);
        document.getElementById('createBatchBtn').textContent = cls ? 'Save' : 'Create Batch';
        document.getElementById('batchTermInput').value = cls ? cls.term : '';
        openModal(batchModal);
    }
    window.openBatchModal = openBatchModal;
    on('openBatchModalBtn', 'click', () => openBatchModal());
    on('cancelBatchBtn', 'click', () => closeModal(batchModal));
    on('createBatchBtn', 'click', () => {
        const term = document.getElementById('batchTermInput').value.trim();
        if(!term) return showToast('Enter a batch name first.', 'warn');
        if(editingCode){
            updateClass(editingCode, {term});
            closeModal(batchModal);
            renderClasses();
            return showToast('Batch renamed.', 'success');
        }
        const me = getJSON('ic_session', null) || {};
        const prefix = programShort(me.program) || 'OJT';   // same format as the register code (ex. BSCS-X7K2QP)
        let code;
        do { code = prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); } while(getClasses()[code]);
        const stored = getJSON('ic_classes', {});
        stored[code] = {program: me.program, theme: me.theme, school: me.school, coordinator: me.email, term, status: 'active', createdAt: todayISO()};
        localStorage.setItem('ic_classes', JSON.stringify(stored));
        setActiveClass(code);
        closeModal(batchModal);
        refreshHeaderCode();
        renderClasses();
        showToast('Batch created. Class code: ' + code, 'success');
    });
}


/* ============ Vault data (pages below use it) ============ */

// Shared vault per partner company (prototype storage: ic_vault)
// { company: { folders: [{id, name, parent, system, intern}], files: [{id, name, folder, type, owner, uploadedAt, version, pending}] } }
// Letters are made and signed outside the system; the vault only keeps and shares the signed scans.
const VAULT_KEY = 'ic_vault';
const VAULT_TYPES = ['MOA / MOU', 'Endorsement letter', 'Acceptance letter', 'Supervisor evaluation', 'DTR / attendance', 'Company document', 'Other'];
const PARTNER_COMPANIES = ['Brightpath Software', 'Verano Digital Studio', 'Nova Retail Systems', 'Cavite Provincial IT Office'];

const getVaults = () => getJSON(VAULT_KEY, {});
const saveVaults = (all) => localStorage.setItem(VAULT_KEY, JSON.stringify(all));
const vaultId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fileSlug = (text) => text.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');


/* ============ Holidays and no-work days (per batch) ============ */

// Prototype storage: ic_holidays {classCode: [{date, name, type}]}. Holidays are not counted as absences.
const HOLIDAY_KEY = 'ic_holidays';
const PH_HOLIDAYS_2026 = [
    ['2026-01-01', "New Year's Day", 'Regular holiday'], ['2026-02-17', 'Chinese New Year', 'Special non-working day'],
    ['2026-04-02', 'Maundy Thursday', 'Regular holiday'], ['2026-04-03', 'Good Friday', 'Regular holiday'],
    ['2026-04-04', 'Black Saturday', 'Special non-working day'], ['2026-04-09', 'Araw ng Kagitingan', 'Regular holiday'],
    ['2026-05-01', 'Labor Day', 'Regular holiday'], ['2026-06-12', 'Independence Day', 'Regular holiday'],
    ['2026-08-21', 'Ninoy Aquino Day', 'Special non-working day'], ['2026-08-31', 'National Heroes Day', 'Regular holiday'],
    ['2026-11-01', "All Saints' Day", 'Special non-working day'], ['2026-11-30', 'Bonifacio Day', 'Regular holiday'],
    ['2026-12-08', 'Feast of the Immaculate Conception', 'Special non-working day'], ['2026-12-24', 'Christmas Eve', 'Special non-working day'],
    ['2026-12-25', 'Christmas Day', 'Regular holiday'], ['2026-12-30', 'Rizal Day', 'Regular holiday'], ['2026-12-31', 'Last Day of the Year', 'Special non-working day']
];
function getHolidays(){
    const all = getJSON(HOLIDAY_KEY, {}), code = activeClassCode() || 'default';
    if(!all[code]){
        all[code] = PH_HOLIDAYS_2026.filter(h => ['2026-06-12', '2026-08-21', '2026-08-31'].includes(h[0])).map(([date, name, type]) => ({date, name, type}));
        localStorage.setItem(HOLIDAY_KEY, JSON.stringify(all));
    }
    return all[code].slice().sort((a, b) => a.date.localeCompare(b.date));
}
function saveHolidays(list){
    const all = getJSON(HOLIDAY_KEY, {});
    all[activeClassCode() || 'default'] = list;
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(all));
}

// Records whose 5-year retention ended are anonymized; only a hash is kept so they stay hidden
const ANON_KEY = 'ic_anonymized';
const nameHash = (name) => { let h = 5381; for(const c of name) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const isAnonymized = (name) => getJSON(ANON_KEY, []).includes(nameHash(name));
const plusYears = (iso, n) => iso.replace(/^\d{4}/, y => String(Number(y) + n));

// Real clock-ins from the student portal: ic_live_attendance {name: {date: {in, out, hours, photoIn, lat, lng, dist}}}
const LIVE_KEY = 'ic_live_attendance';
const liveRecs = (name) => getJSON(LIVE_KEY, {})[name] || {};
const liveHours = (name) => Object.values(liveRecs(name)).reduce((t, r) => t + (r.hours || 0), 0);


/* ============ Intern attendance records (clock-in / clock-out) ============ */

// Each clock-in and clock-out has a live camera photo, a server timestamp and a GPS point checked against the company geofence.
// Prototype: records are generated from the intern's rendered hours. Coordinator reviews of flagged records are saved in ic_attendance_review.
const ATT_REVIEW_KEY = 'ic_attendance_review';
const DELETION_KEY = 'ic_deletion_requests';
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
const AUDIT_KEY = 'ic_audit';
function logAudit(action, status, system){
    const sess = getJSON('ic_session', {});
    const d = new Date();
    const all = getJSON(AUDIT_KEY, []);
    all.push({at: isoDate(d) + ' ' + d.toTimeString().slice(0, 8), action, status: status || 'Success',
        user: system ? 'system-auto' : 'coord-' + (sess.name || 'coordinator').split(/\s+/).map(w => w[0]).join('').toLowerCase() + '-001',
        ip: system ? 'internal' : '203.177.**.**'});
    localStorage.setItem(AUDIT_KEY, JSON.stringify(all.slice(-500)));
}

// Work schedule of a deployed intern, set by the coordinator at deployment (partners may update it if they use the portal)
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function scheduleOf(p){ return Object.assign({days: [1, 2, 3, 4, 5], timeIn: '08:00', timeOut: '17:00', grace: 15, mode: WORK_MODE[p.name] || 'On-site'}, p.schedule || {}); }
function clockMins(t){ return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }
function scheduleText(sc){ return sc.days.map(d => DAY_NAMES[d]).join(', ') + ' · ' + fmtClock(clockMins(sc.timeIn)) + ' – ' + fmtClock(clockMins(sc.timeOut)); }
function openScheduleModal(p, title, onSave){
    let m = document.getElementById('scheduleModal');
    const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="scheduleModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 id="schedTitle" class="font-bold text-slate-900"></h3><button data-sched="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p class="text-[12px] text-slate-500 mb-4">Copy the schedule from the acceptance letter or from the company. Late is counted from this schedule.</p>'
          + '<div class="text-[12.5px] font-medium text-slate-600 mb-1">Work days</div><div class="flex flex-wrap gap-1.5 mb-3">'
          + [1, 2, 3, 4, 5, 6, 0].map(d => '<label class="text-[12px] text-slate-700 border border-slate-200 rounded-md px-2 py-1 cursor-pointer has-[:checked]:bg-sky-50 has-[:checked]:border-sky-300"><input type="checkbox" class="sched-day mr-1 accent-sky-600" value="' + d + '">' + DAY_NAMES[d] + '</label>').join('') + '</div>'
          + '<div class="grid grid-cols-2 gap-3 mb-3"><div><label for="schedIn" class="text-[12.5px] font-medium text-slate-600 block mb-1">Time in</label><input id="schedIn" type="time" class="' + field + '"></div>'
          + '<div><label for="schedOut" class="text-[12.5px] font-medium text-slate-600 block mb-1">Time out</label><input id="schedOut" type="time" class="' + field + '"></div>'
          + '<div><label for="schedGrace" class="text-[12.5px] font-medium text-slate-600 block mb-1">Grace period (mins)</label><input id="schedGrace" type="number" min="0" max="60" class="' + field + '"></div>'
          + '<div><label for="schedMode" class="text-[12.5px] font-medium text-slate-600 block mb-1">Work setup</label><select id="schedMode" class="' + field + '"><option>On-site</option><option>Hybrid</option><option>Remote</option></select></div></div>'
          + '<label class="flex items-center gap-2 text-[12.5px] text-slate-700 mt-1"><input id="schedOwnSite" type="checkbox" class="accent-sky-600"> Intern reports to a different branch</label>'
          + '<div id="schedSiteBox" class="hidden mt-2 grid grid-cols-[1fr_96px] gap-2"><input id="schedSitePlace" placeholder="Branch name" class="' + field + '"><select id="schedSiteRadius" class="' + field + '">' + RADIUS_OPTIONS.map(r => '<option value="' + r + '">' + r + ' m</option>').join('') + '</select>'
          + '<input id="schedSiteCoords" placeholder="Google Maps link or lat, lng" class="' + field + ' col-span-2"></div>'
          + '<div class="flex justify-end gap-2.5 mt-5"><button data-sched="close" class="text-[12.5px] font-medium text-slate-500 hover:text-slate-700 px-3.5 py-2">Cancel</button>'
          + '<button data-sched="save" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-md transition">Save</button></div></div></div>');
        m = document.getElementById('scheduleModal');
        m.addEventListener('change', (e) => { if(e.target.id === 'schedOwnSite') document.getElementById('schedSiteBox').classList.toggle('hidden', !e.target.checked); });
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sched]');
            if(!b) return;
            if(b.dataset.sched === 'close'){ closeModal(m); return; }
            if(b.dataset.sched !== 'save') return;
            const sched = {days: [...m.querySelectorAll('.sched-day:checked')].map(c => Number(c.value)).sort(),
                timeIn: document.getElementById('schedIn').value, timeOut: document.getElementById('schedOut').value,
                grace: Math.max(0, Number(document.getElementById('schedGrace').value) || 0), mode: document.getElementById('schedMode').value, site: null};
            if(document.getElementById('schedOwnSite').checked){
                const c = parseCoords(document.getElementById('schedSiteCoords').value), place = document.getElementById('schedSitePlace').value.trim();
                if(!c || !place){ showToast('Add the branch name and its location (Google Maps link or lat, lng).', 'warn'); return; }
                sched.site = {lat: c.lat, lng: c.lng, place, radius: Number(document.getElementById('schedSiteRadius').value)};
            }
            if(!sched.days.length){ showToast('Pick at least one work day.', 'warn'); return; }
            if(!sched.timeIn || !sched.timeOut || clockMins(sched.timeOut) <= clockMins(sched.timeIn)){ showToast('Time out must be later than time in.', 'warn'); return; }
            closeModal(m);
            m._onSave(sched);
        });
    }
    const sc = scheduleOf(p);
    document.getElementById('schedTitle').textContent = title;
    m.querySelectorAll('.sched-day').forEach(c => { c.checked = sc.days.includes(Number(c.value)); });
    const own = sc.site, base = companySite(p.company);
    document.getElementById('schedOwnSite').checked = !!own;
    document.getElementById('schedSiteBox').classList.toggle('hidden', !own);
    document.getElementById('schedSitePlace').value = own ? own.place : '';
    document.getElementById('schedSiteCoords').value = own ? own.lat + ', ' + own.lng : '';
    document.getElementById('schedSiteRadius').value = String(own ? own.radius : base.radius);
    document.getElementById('schedIn').value = sc.timeIn;
    document.getElementById('schedOut').value = sc.timeOut;
    document.getElementById('schedGrace').value = sc.grace;
    document.getElementById('schedMode').value = sc.mode;
    m._onSave = onSave;
    openModal(m);
}
const fmtClock = (mins) => { if(mins == null) return '—'; const h = Math.floor(mins / 60), m = mins % 60; return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };

// Newest first. Weekdays only, going back from the last working day until the rendered hours are used up.
function internAttendance(p){
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
        if(onSchedule && r < 0.05){ out.push({date, status: 'Absent', hours: 0}); continue; }
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
        const status = l.out == null ? 'Clocked in' : !onSched ? 'Outside schedule' : !remote && l.dist > site.radius ? 'Flagged' : l.in > start + sched.grace ? 'Late' : 'Present';
        return {date, timeIn: l.in, timeOut: l.out, hours: l.hours || 0, lat: l.lat, lng: l.lng, dist: remote ? null : l.dist, remote, live: true, photoIn: l.photoIn,
            radius: site.radius, place: remote ? 'Remote (work from home)' : site.place, status, review: reviews[p.name + '|' + date] || ''};
    });
    return liveOut.concat(out.filter(r => !live[r.date]));
}
const rejectedHours = (p) => internAttendance(p).filter(r => r.review === 'rejected').reduce((t, r) => t + r.hours, 0);
const pendingFlags = (p) => internAttendance(p).filter(r => r.status === 'Flagged' && !r.review).length;

// Placeholder for the live camera capture, stamped with the server time and GPS point
function clockPhoto(p, rec, kind){
    if(rec.live && rec.photoIn) return rec.photoIn;
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


/* ============ Placements data (application → endorsement → acceptance → deployment) ============ */

// One status per student, shared by Placements, the Intern profile, the Roster and the vault.
// Letters are made and signed outside the system; a step only moves forward once its signed scan is in the intern's vault folder.
const PLACEMENT_KEY = 'ic_placements';
const PLACEMENT_STEPS = ['Not placed', 'Applied', 'Endorsed', 'Accepted', 'Deployed', 'Hours complete', 'Completed'];
const PLACEMENT_BADGE = {
    'Not placed': 'text-slate-600 bg-slate-100 border-slate-200',
    'Applied': 'text-indigo-700 bg-indigo-50 border-indigo-200',
    'Endorsed': 'text-sky-700 bg-sky-50 border-sky-200',
    'Accepted': 'text-teal-700 bg-teal-50 border-teal-200',
    'Deployed': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Hours complete': 'text-amber-700 bg-amber-50 border-amber-200',
    'Completed': 'text-violet-700 bg-violet-50 border-violet-200',
    'Withdrawn': 'text-red-600 bg-red-50 border-red-200'
};
// Sample students who are not deployed yet (deployed ones come from the roster)
const PLACEMENT_SEED = {
    'Bea R.': {status: 'Not placed', company: '', studentNo: '2023-0190', history: []},
    'Carlo M.': {status: 'Applied', company: 'Cavite Provincial IT Office', studentNo: '2023-0103', history: [{status: 'Applied', date: '2026-06-03', note: 'Cavite Provincial IT Office'}]},
    'Ella S.': {status: 'Endorsed', company: 'Verano Digital Studio', studentNo: '2023-0127', docs: ['Endorsement letter'],
        history: [{status: 'Applied', date: '2026-06-01', note: 'Verano Digital Studio'}, {status: 'Endorsed', date: '2026-06-08'}]},
    'Nico F.': {status: 'Accepted', company: 'Nova Retail Systems', studentNo: '2023-0164', docs: ['Endorsement letter', 'Acceptance letter'],
        history: [{status: 'Applied', date: '2026-05-28', note: 'Nova Retail Systems'}, {status: 'Endorsed', date: '2026-06-04'}, {status: 'Accepted', date: '2026-06-12'}]}
};
const SAMPLE_STUDENT_NO = {'Aiyu T.': '2023-0141', 'Kaye P.': '2023-0056', 'Leo A.': '2023-0088', 'Jomari D.': '2023-0172'};
const getPlacementStore = () => getJSON(PLACEMENT_KEY, {});
function savePlacement(name, patch){
    const all = getPlacementStore();
    all[name] = Object.assign({}, PLACEMENT_SEED[name] || {}, all[name] || {}, patch);
    localStorage.setItem(PLACEMENT_KEY, JSON.stringify(all));
}
const profileLink = (name) => pages.intern + '?name=' + encodeURIComponent(name);
const placementBadge = (status) => '<span class="text-[11px] font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ' + (PLACEMENT_BADGE[status] || PLACEMENT_BADGE['Not placed']) + '">' + status + '</span>';

// Sample history for roster students that were placed before this screen existed
function rosterHistory(m){
    const h = [];
    if(m.company && !m.real){
        const old = m.status === 'alumni';
        h.push({status: 'Applied', date: old ? '2025-10-06' : '2026-05-20', note: m.company}, {status: 'Endorsed', date: old ? '2025-10-13' : '2026-05-27'},
               {status: 'Accepted', date: old ? '2025-10-20' : '2026-06-03'}, {status: 'Deployed', date: old ? '2025-11-03' : '2026-06-15'});
        if(m.hours >= REQUIRED_HOURS) h.push({status: 'Hours complete', date: m.completedAt || '2026-09-30'});
    }
    if(m.status === 'alumni') h.push({status: 'Completed', date: m.completedAt || todayISO()});
    if(m.status === 'withdrawn') h.push({status: 'Withdrawn', date: m.withdrawnAt || todayISO()});
    return h;
}

// Every student with their placement status
function placementList(){
    const store = getPlacementStore();
    const out = {};
    Object.keys(PLACEMENT_SEED).forEach(n => { out[n] = Object.assign({name: n}, PLACEMENT_SEED[n], store[n] || {}); });
    const roster = sampleMembers.map(m => Object.assign({}, m))
        .concat(getUsers().filter(u => u.role === 'student' && u.status !== 'pending').map(u => ({
            real: true, email: u.email, name: u.name, company: u.company || '', hours: u.ojtHours || u.hours || 0,
            status: u.status === 'alumni_pending' ? 'intern' : (u.status || 'intern'), completedAt: u.completedAt, withdrawnAt: u.withdrawnAt})));
    roster.forEach(m => {
        if(out[m.name]) return;
        const company = m.company === '—' ? '' : m.company;
        const status = m.status === 'alumni' ? 'Completed' : m.status === 'withdrawn' ? 'Withdrawn'
            : !company ? 'Not placed' : m.hours >= REQUIRED_HOURS ? 'Hours complete' : 'Deployed';
        out[m.name] = Object.assign({name: m.name, company, hours: m.hours, status, roster: true, real: m.real, email: m.email,
            studentNo: SAMPLE_STUDENT_NO[m.name] || '', history: rosterHistory(Object.assign({}, m, {company}))}, store[m.name] || {});
    });
    return Object.values(out).filter(p => !isAnonymized(p.name)).map(p => {
        if(!p.company || !['Deployed', 'Hours complete', 'Completed'].includes(p.status)) return p;
        const rawHours = (p.hours || 0) + liveHours(p.name), rejected = rejectedHours(Object.assign({}, p, {rawHours}));
        const hours = Math.max(0, rawHours - rejected);
        return Object.assign(p, {rawHours, hours, status: p.status === 'Hours complete' && hours < REQUIRED_HOURS ? 'Deployed' : p.status});
    });
}

// Signed scans in the intern's vault folder
function internDocs(company, name){
    if(!company) return [];
    const v = ensureVault(company);
    const folder = v.folders.find(f => f.intern === name);
    if(!folder) return [];
    const ids = [folder.id].concat(subfolderIds(v, folder.id));
    return v.files.filter(f => ids.includes(f.folder));
}
const hasDoc = (company, name, type) => internDocs(company, name).some(f => f.type === type);


/* ============ Batch Roster ============ */

// Sample rows so the design can be reviewed (real students of the batch are added on top)
const sampleMembers = [
    {id: 's1', name: 'Aiyu T.', company: 'Brightpath Software', hours: 486, status: 'intern'},
    {id: 's2', name: 'Kaye P.', company: 'Brightpath Software', hours: 420, status: 'intern'},
    {id: 's3', name: 'Leo A.', company: 'Nova Retail Systems', hours: 318, status: 'intern'},
    {id: 's4', name: 'Jomari D.', company: 'Verano Digital Studio', hours: 150, status: 'intern'},
    {id: 's5', name: 'Mara L.', company: 'Brightpath Software', hours: 486, status: 'alumni', completedAt: '2026-03-14', employment: 'employed'},
    {id: 's6', name: 'Rico S.', company: 'Nova Retail Systems', hours: 486, status: 'alumni', completedAt: '2026-03-14', employment: 'seeking'},
    {id: 's7', name: 'Dana V.', company: '—', hours: 72, status: 'withdrawn', withdrawnAt: '2026-02-20'}
];
let rosterMembers = [];

function loadRoster(){
    const code = activeClassCode();
    const real = getUsers()
        .filter(u => u.role === 'student' && u.classCode === code && u.status !== 'pending')
        .map(u => ({id: u.email, real: true, name: u.name, company: u.company || '—', hours: u.ojtHours || u.hours || 0,
                    requested: u.status === 'alumni_pending',
                    status: u.status === 'alumni_pending' ? 'intern' : (u.status || 'intern'), completedAt: u.completedAt, withdrawnAt: u.withdrawnAt, employment: u.employment || 'seeking'}));
    const placed = placementList().filter(p => !p.roster && p.deployedAt)
        .map(p => Object.assign({id: 'p:' + p.name, placement: true, name: p.name, company: p.company, hours: p.hours || 0, status: 'intern'}, p.rosterPatch || {}));
    const store = getPlacementStore();
    const credited = Object.fromEntries(placementList().map(p => [p.name, p.hours]));
    rosterMembers = real.concat(placed, sampleMembers.map(m => Object.assign({sample: true}, m, (store[m.name] || {}).rosterPatch || {})))
        .filter(m => !isAnonymized(m.name))
        .map(m => credited[m.name] != null && m.status === 'intern' ? Object.assign(m, {hours: credited[m.name]}) : m);
}
function memberName(m){
    return '<div><a href="' + profileLink(m.name) + '" class="font-semibold text-slate-900 hover:text-sky-700 hover:underline">' + esc(m.name) + '</a>' + (m.requested ? ' <span class="ml-1 text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Alumni requested</span>' : '') + '</div>';
}
function setMember(m, patch){
    Object.assign(m, patch);
    if(m.real) updateUser(m.id, 'student', patch);
    if(m.placement || m.sample){
        const p = placementList().find(x => x.name === m.name) || {};
        const next = {rosterPatch: Object.assign({}, p.rosterPatch, patch)};
        const status = patch.status === 'alumni' ? 'Completed' : patch.status === 'withdrawn' ? 'Withdrawn' : '';
        if(status) Object.assign(next, {status, history: (p.history || []).concat({status, date: todayISO()})});
        savePlacement(m.name, next);
    }
}

function renderRoster(){
    const cls = activeClass();
    if(!cls){ document.getElementById('rosterTitle').textContent = 'No batch selected'; return; }
    document.getElementById('rosterTitle').textContent = cls.term;
    document.getElementById('rosterMeta').textContent = (cls.program || '') + ' · Class Code ' + cls.code;
    const badge = document.getElementById('rosterStatus');
    badge.textContent = capitalize(cls.status);
    badge.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[cls.status];
    document.getElementById('closeBatchBtn').classList.toggle('hidden', cls.status !== 'active');

    const interns = rosterMembers.filter(m => m.status === 'intern');
    const alumni = rosterMembers.filter(m => m.status === 'alumni');
    const withdrawn = rosterMembers.filter(m => m.status === 'withdrawn');
    document.getElementById('rosterInternsCount').textContent = '(' + interns.length + ')';
    document.getElementById('rosterAlumniCount').textContent = '(' + alumni.length + ')';
    document.getElementById('rosterWithdrawnCount').textContent = '(' + withdrawn.length + ')';

    const fill = (id, rows) => {
        document.getElementById(id).innerHTML = rows.join('');
        document.getElementById(id + 'Empty').classList.toggle('hidden', rows.length > 0);
    };
    fill('rosterInternsBody', interns.map(m => {
        const pct = Math.min(100, Math.round(m.hours / REQUIRED_HOURS * 100));
        const done = m.hours >= REQUIRED_HOURS;
        const evalIn = done && hasDoc(m.company, m.name, 'Supervisor evaluation');
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + esc(m.company) + '</td>'
          + '<td class="px-4 py-3"><div class="flex items-center gap-2"><div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-sky-600" style="width:' + pct + '%"></div></div><span class="text-[11.5px] text-slate-500">' + m.hours + ' / ' + REQUIRED_HOURS + '</span></div></td>'
          + '<td class="px-4 py-3"><div class="flex gap-2">'
          + '<button data-act="files" data-id="' + esc(m.id) + '" class="text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md transition"><i class="fa-solid fa-folder-open mr-1"></i>Files</button>'
          + '<button data-act="complete" data-id="' + esc(m.id) + '" ' + (!done ? 'disabled title="Hours not complete yet"' : evalIn ? '' : 'title="Upload the signed supervisor evaluation first"') + ' class="text-[11px] font-semibold px-2.5 py-1 rounded-md transition ' + (!done ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : evalIn ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100') + '">' + (done && !evalIn ? '<i class="fa-solid fa-lock mr-1 text-[9px]"></i>' : '') + 'Mark completed</button>'
          + '<button data-act="withdraw" data-id="' + esc(m.id) + '" class="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition">Withdraw</button>'
          + '</div></td></tr>';
    }));
    fill('rosterAlumniBody', alumni.map(m => {
        const date = m.completedAt || todayISO();
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + formatDate(date) + '</td>'
          + '<td class="px-4 py-3"><select data-act="employment" data-id="' + esc(m.id) + '" class="border border-slate-300 rounded-md px-2 py-1 text-[11.5px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400">'
          +   '<option value="seeking"' + (m.employment === 'employed' ? '' : ' selected') + '>Seeking work</option>'
          +   '<option value="employed"' + (m.employment === 'employed' ? ' selected' : '') + '>Employed</option></select></td>'
          + '<td class="px-4 py-3 text-slate-600">' + retainUntil(date) + '</td></tr>';
    }));
    fill('rosterWithdrawnBody', withdrawn.map(m => {
        const date = m.withdrawnAt || todayISO();
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + formatDate(date) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + retainUntil(date) + '</td></tr>';
    }));
}

if(document.getElementById('rosterInternsBody')){
    loadRoster();
    renderRoster();
    on('backToClassesBtn', 'click', () => goTo('classes'));
    on('goRequestsBtn', 'click', () => goTo('requests'));

    document.getElementById('tab-roster').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if(!btn || btn.disabled) return;
        const m = rosterMembers.find(x => x.id === btn.dataset.id);
        if(!m) return;
        if(btn.dataset.act === 'files'){ openInternFiles(m.company, m.name); return; }
        if(btn.dataset.act === 'complete'){
            if(!hasDoc(m.company, m.name, 'Supervisor evaluation')){
                if(confirm('There is no signed supervisor evaluation scan in ' + m.name + "'s vault folder yet.\n\nOpen the folder to upload it?")) openInternFiles(m.company, m.name);
                return;
            }
            setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking', requested: false});
            if(m.real) saveAlumniRequests(getAlumniRequests().map(r => (r.email === m.id && r.status === 'pending') ? Object.assign({}, r, {status: 'approved'}) : r));
            logAudit('Marked ' + m.name + ' as completed (Alumni)');
            showToast(m.name + ' is now an alumni. Records kept until ' + retainUntil(todayISO()) + '.', 'success');
        }
        if(btn.dataset.act === 'withdraw'){
            if(!confirm('Mark ' + m.name + ' as withdrawn? They will stay in this batch records.')) return;
            setMember(m, {status: 'withdrawn', withdrawnAt: todayISO()});
            showToast(m.name + ' was marked as withdrawn.', 'warn');
        }
        renderRoster();
    });
    document.getElementById('tab-roster').addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-act="employment"]');
        if(!sel) return;
        const m = rosterMembers.find(x => x.id === sel.dataset.id);
        setMember(m, {employment: sel.value});
        showToast(m.name + ' marked as ' + (sel.value === 'employed' ? 'employed.' : 'seeking work.'), 'info');
    });

    // Close Batch: interns with complete hours become alumni, the rest stay in this batch
    on('closeBatchBtn', 'click', () => {
        const ready = rosterMembers.filter(m => m.status === 'intern' && m.hours >= REQUIRED_HOURS && hasDoc(m.company, m.name, 'Supervisor evaluation'));
        const ongoing = rosterMembers.filter(m => m.status === 'intern').length - ready.length;
        if(!confirm('Close this batch? ' + ready.length + ' intern(s) with complete hours and a supervisor evaluation will become alumni. ' + ongoing + ' will stay until they finish. No new students can join.')) return;
        ready.forEach(m => setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking'}));
        updateClass(activeClassCode(), {status: 'closed'});
        renderRoster();
        showToast('Batch closed. ' + ready.length + ' moved to Alumni, ' + ongoing + ' still ongoing.', 'success');
    });
}


/* ============ Attendance and Progress ============ */

// Rows: every deployed intern (Deployed or Hours complete), same status as Placements and the Roster
// Interns who just started (0 hours) are not flagged yet
const internAtRisk = (p) => p.status === 'Deployed' && p.hours > 0 && p.hours / REQUIRED_HOURS < 0.4;
function attendanceRow(p){
    const hours = p.hours || 0;
    const pct = Math.min(100, Math.round(hours / REQUIRED_HOURS * 100));
    const risk = internAtRisk(p);
    const mode = scheduleOf(p).mode;
    const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const riskBadge = p.status === 'Hours complete'
        ? '<span class="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Hours complete</span>'
        : !hours ? '<span class="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Just started</span>'
        : risk ? '<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">At-Risk</span>'
        : '<span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">On Track</span>';
    return '<tr' + (risk ? ' class="bg-red-50/40"' : '') + ' data-intern="' + esc(p.name) + '" data-name="' + esc((p.name + ' ' + (p.studentNo || '')).toLowerCase()) + '" data-company="' + esc(p.company) + '" data-status="' + mode + '">'
      + '<td class="px-5 py-3"><div class="flex items-center gap-2.5"><div class="w-7 h-7 rounded-full ' + (risk ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700') + ' text-[11px] font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
      + '<div><div>' + esc(p.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(p.studentNo || '') + '</div></div></div></td>'
      + '<td class="px-5 py-3 text-[13px] text-slate-600">' + esc(p.company) + '</td>'
      + '<td class="px-5 py-3"><div class="flex items-center gap-2"><div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ' + (risk ? 'bg-red-500' : 'bg-sky-600') + '" style="width:' + pct + '%"></div></div><span class="text-[11.5px] text-slate-500">' + hours + ' / ' + REQUIRED_HOURS + '</span></div></td>'
      + '<td class="px-5 py-3"><span class="text-[11px] font-medium ' + (mode === 'On-site' ? 'text-slate-600 bg-slate-100' : 'text-sky-700 bg-sky-50') + ' px-2 py-0.5 rounded-full">' + mode + '</span></td>'
      + '<td class="px-5 py-3">' + riskBadge + '</td>'
      + '<td class="px-5 py-3 whitespace-nowrap"><div class="flex items-center gap-2"><button class="attendance-log text-[11.5px] font-medium text-sky-600 hover:text-sky-700">View Log</button>'
      + '<span class="w-[66px] flex">' + (pendingFlags(p) ? '<span class="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full" title="Clock-ins outside the geofence to review">' + pendingFlags(p) + ' flagged</span>' : '') + '</span>'
      + '<button class="attendance-files text-[11.5px] font-medium text-slate-500 hover:text-sky-700"><i class="fa-solid fa-folder-open mr-1"></i>Files</button></div></td></tr>';
}
function renderAttendance(){
    const list = placementList().filter(p => ['Deployed', 'Hours complete'].includes(p.status)).sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById('attendanceTbody').innerHTML = list.map(attendanceRow).join('');
    filterAttendance();
}

// Search + Filter
function filterAttendance(){
    const q = (document.getElementById('studentSearch').value || '').toLowerCase().trim();
    const company = document.getElementById('companyFilter').value;
    const status = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#attendanceTbody tr');
    let visibleCount = 0;
    rows.forEach(row => {
      const name = row.dataset.name || '';
      const rowCompany = row.dataset.company || '';
      const rowStatus = row.dataset.status || '';
      const matchesQuery = !q || name.includes(q);
      const matchesCompany = !company || rowCompany === company;
      const matchesStatus = !status || rowStatus === status;
      const show = matchesQuery && matchesCompany && matchesStatus;
      row.classList.toggle('hidden', !show);
      if(show) visibleCount++;
    });
    document.getElementById('attendanceNoResults').classList.toggle('hidden', visibleCount !== 0);
}
on('studentSearch', 'input', filterAttendance);
on('companyFilter', 'change', filterAttendance);
on('statusFilter', 'change', filterAttendance);
if(document.getElementById('attendanceTbody')){
    document.getElementById('companyFilter').insertAdjacentHTML('beforeend', PARTNER_COMPANIES.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join(''));
    renderAttendance();
}

// Holidays and no-work days: pick a Philippine holiday or type one in (suspensions, company events)
function holidayModal(){
    let m = document.getElementById('holidayModal');
    const field = 'border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="holidayModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 class="font-bold text-slate-900">Holidays &amp; no-work days</h3><button data-hol="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p class="text-[12px] text-slate-500 mb-4">Interns are not marked absent on these days. Applies to the whole batch.</p>'
          + '<div id="holList" class="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg mb-4"></div>'
          + '<div class="text-[12.5px] font-medium text-slate-600 mb-1">Add a day</div>'
          + '<select id="holPreset" class="' + field + ' w-full mb-2"></select>'
          + '<div class="grid grid-cols-[140px_1fr] gap-2 mb-2"><input id="holDate" type="date" class="' + field + '"><input id="holName" type="text" placeholder="Name (e.g. Class suspension, Company anniversary)" class="' + field + '"></div>'
          + '<div class="flex items-center gap-2"><select id="holType" class="' + field + ' flex-1"><option>Regular holiday</option><option>Special non-working day</option><option>Class / work suspension</option><option>Company no-work day</option></select>'
          + '<button data-hol="add" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">Add</button></div>'
          + '<p class="text-[11px] text-slate-400 mt-2">Check the official proclamation for moved or added holidays (e.g. Eid\'l Fitr, Eid\'l Adha) and add them manually.</p></div></div>');
        m = document.getElementById('holidayModal');
        m.addEventListener('change', (e) => {
            if(e.target.id !== 'holPreset' || !e.target.value) return;
            const h = PH_HOLIDAYS_2026.find(x => x[0] === e.target.value);
            document.getElementById('holDate').value = h[0]; document.getElementById('holName').value = h[1]; document.getElementById('holType').value = h[2];
        });
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-hol]');
            if(!b) return;
            if(b.dataset.hol === 'close'){ closeModal(m); return; }
            const list = getHolidays();
            if(b.dataset.hol === 'del'){
                const h = list.find(x => x.date === b.dataset.date);
                saveHolidays(list.filter(x => x.date !== b.dataset.date));
                logAudit('Removed ' + h.name + ' (' + h.date + ') from the holidays of the batch');
            }
            if(b.dataset.hol === 'add'){
                const date = document.getElementById('holDate').value, name = document.getElementById('holName').value.trim(), type = document.getElementById('holType').value;
                if(!date || !name){ showToast('Pick a date and add a name.', 'warn'); return; }
                if(list.some(x => x.date === date)){ showToast(formatDate(date) + ' is already in the list.', 'warn'); return; }
                saveHolidays(list.concat({date, name, type}));
                logAudit('Added ' + name + ' (' + date + ', ' + type.toLowerCase() + ') to the holidays of the batch');
                document.getElementById('holDate').value = ''; document.getElementById('holName').value = '';
            }
            fillHolidayModal();
            renderAttendance();
        });
    }
    fillHolidayModal();
    openModal(m);
}
function fillHolidayModal(){
    const list = getHolidays();
    document.getElementById('holList').innerHTML = list.length ? list.map(h => '<div class="flex items-center justify-between gap-3 px-3 py-2">'
        + '<div><div class="text-[12.5px] font-medium text-slate-800">' + esc(h.name) + '</div><div class="text-[11px] text-slate-400">' + formatDate(h.date) + ' · ' + new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'short'}) + ' · ' + esc(h.type) + '</div></div>'
        + '<button data-hol="del" data-date="' + h.date + '" class="text-slate-400 hover:text-red-600 text-[12px]" title="Remove"><i class="fa-solid fa-trash-can"></i></button></div>').join('')
        : '<div class="px-3 py-4 text-center text-[12px] text-slate-400">No holidays yet.</div>';
    document.getElementById('holPreset').innerHTML = '<option value="">Pick a Philippine holiday (2026)…</option>'
        + PH_HOLIDAYS_2026.filter(h => !list.some(x => x.date === h[0])).map(h => '<option value="' + h[0] + '">' + formatDate(h[0]) + ' · ' + esc(h[1]) + ' (' + h[2] + ')</option>').join('');
    document.getElementById('holidaysCount').textContent = '(' + list.length + ')';
}
if(document.getElementById('holidaysBtn')){
    document.getElementById('holidaysCount').textContent = '(' + getHolidays().length + ')';
    on('holidaysBtn', 'click', holidayModal);
}

// View Log opens the Intern profile, Files opens the intern's folder in their partner's vault
document.getElementById('attendanceTbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.attendance-files, .attendance-log');
    if(!btn) return;
    const row = btn.closest('tr');
    const name = row.dataset.intern;
    if(btn.classList.contains('attendance-log')) window.location.href = profileLink(name) + '#attendance';
    else openInternFiles(row.dataset.company, name);
});


/* ============ Partner and MOA Directory ============ */


// Opens the intern's folder in their partner's vault (used by the Roster and Attendance pages)
function openInternFiles(company, intern){
    if(!company || company === '—'){ showToast(intern + ' has no partner company yet.', 'warn'); return; }
    window.location.href = pages.partners + '?vault=' + encodeURIComponent(company) + '&intern=' + encodeURIComponent(intern);
}

// Interns deployed to a company (real students + sample roster)
function internsOf(company){
    const real = getUsers().filter(u => u.role === 'student' && u.company === company && u.status !== 'pending').map(u => u.name);
    const sample = sampleMembers.filter(m => m.company === company).map(m => m.name);
    const placed = placementList().filter(p => p.company === company && p.status !== 'Not placed').map(p => p.name);
    return [...new Set(real.concat(sample, placed))];
}

// Creates the default folders the first time, and one folder per intern deployed to the company
function ensureVault(company){
    const all = getVaults();
    let v = all[company];
    if(!v){
        v = {folders: [
            {id: 'agreements', name: 'Agreements (MOA / MOU)', parent: null, system: true},
            {id: 'company', name: 'Company documents', parent: null, system: true},
            {id: 'interns', name: 'Interns', parent: null, system: true}
        ], files: [
            {id: vaultId(), name: 'MOA_' + fileSlug(company) + '_2026.pdf', folder: 'agreements', type: 'MOA / MOU', owner: 'hr', uploadedAt: '2026-06-02', version: 1},
            {id: vaultId(), name: 'Company_Profile.pdf', folder: 'company', type: 'Company document', owner: 'coordinator', uploadedAt: '2026-06-05', version: 1}
        ]};
        all[company] = v;
    }
    internsOf(company).forEach(name => {
        if(v.folders.some(f => f.intern === name)) return;
        const id = 'intern-' + vaultId();
        v.folders.push({id, name, parent: 'interns', system: true, intern: name});
        if(sampleMembers.some(m => m.name === name && m.company === company)){
            const slug = fileSlug(name);
            v.files.push({id: vaultId(), name: 'Endorsement_Letter_' + slug + '.pdf', folder: id, type: 'Endorsement letter', owner: 'coordinator', uploadedAt: '2026-06-10', version: 1});
            v.files.push({id: vaultId(), name: 'Acceptance_Letter_' + slug + '.pdf', folder: id, type: 'Acceptance letter', owner: 'hr', uploadedAt: '2026-06-14', version: 1});
            if(sampleMembers.some(m => m.name === name && m.status === 'alumni'))
                v.files.push({id: vaultId(), name: 'Supervisor_Evaluation_' + slug + '.pdf', folder: id, type: 'Supervisor evaluation', owner: 'hr', uploadedAt: '2026-03-10', version: 1},
                             {id: vaultId(), name: 'DTR_' + slug + '.pdf', folder: id, type: 'DTR / attendance', owner: 'coordinator', uploadedAt: '2026-03-12', version: 1});
        }
        const seed = PLACEMENT_SEED[name];
        if(seed && seed.company === company) (seed.docs || []).forEach(type => {
            v.files.push({id: vaultId(), name: type.replace(/ /g, '_').replace(/^./, c => c.toUpperCase()).replace('_letter', '_Letter') + '_' + fileSlug(name) + '.pdf', folder: id, type,
                owner: type === 'Acceptance letter' ? 'hr' : 'coordinator', uploadedAt: '2026-06-0' + (type === 'Acceptance letter' ? '9' : '6'), version: 1});
        });
    });
    saveVaults(all);
    return v;
}
function updateVault(company, change){
    const all = getVaults();
    change(all[company]);
    saveVaults(all);
}

function folderById(v, id){ return v.folders.find(f => f.id === id) || null; }
function folderPath(v, id){
    const path = [];
    let f = folderById(v, id);
    while(f){ path.unshift(f); f = folderById(v, f.parent); }
    return path;
}
const folderLabel = (v, id) => folderPath(v, id).map(f => f.name).join(' › ');
function internOfFolder(v, id){
    const hit = folderPath(v, id).find(f => f.intern);
    return hit ? hit.intern : '';
}
function subfolderIds(v, id){
    return v.folders.filter(f => f.parent === id).reduce((ids, f) => ids.concat(f.id, subfolderIds(v, f.id)), []);
}
function filesUnder(v, id){
    const ids = [id].concat(subfolderIds(v, id));
    return v.files.filter(f => ids.includes(f.folder)).length;
}
function defaultTypeFor(v, folderId){
    if(folderId === 'agreements') return 'MOA / MOU';
    if(folderId === 'company') return 'Company document';
    return internOfFolder(v, folderId) ? 'Endorsement letter' : 'Other';
}

const vaultModal = document.getElementById('vaultModal');
let vaultCompany = '';
let vaultFolder = null;       // null = vault root
let replaceTargetId = null;

const VAULT_BTN = 'text-[10.5px] font-semibold px-2 py-1 rounded-md transition ';
function vaultFolderRow(v, f){
    const count = filesUnder(v, f.id);
    return '<div class="flex items-center justify-between gap-2 border border-slate-200 rounded-md px-3 py-2.5 hover:border-sky-300 transition">'
      + '<button data-open-folder="' + esc(f.id) + '" class="flex items-center gap-2.5 min-w-0 flex-1 text-left">'
      +   '<i class="fa-solid ' + (f.intern ? 'fa-folder-closed' : 'fa-folder') + ' text-amber-400 flex-shrink-0"></i>'
      +   '<div class="min-w-0"><div class="text-[12.5px] font-medium text-slate-700 truncate">' + (f.intern ? '<i class="fa-solid fa-user text-[10px] text-slate-400 mr-1"></i>' : '') + esc(f.name) + '</div>'
      +   '<div class="text-[10.5px] text-slate-400">' + count + ' file' + (count === 1 ? '' : 's') + (f.system ? '' : ' · your folder') + '</div></div></button>'
      + (f.system ? '<i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>'
          : '<div class="flex gap-2 flex-shrink-0">'
          +   '<button data-folder-act="rename" data-id="' + esc(f.id) + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-pen mr-1"></i>Rename</button>'
          +   '<button data-folder-act="delete" data-id="' + esc(f.id) + '" class="' + VAULT_BTN + 'text-red-600 bg-red-50 hover:bg-red-100"><i class="fa-solid fa-trash mr-1"></i>Delete</button></div>')
      + '</div>';
}
function vaultFileRow(v, f, showPath){
    const mine = f.owner === 'coordinator';
    const icon = /\.(jpe?g|png)$/i.test(f.name) ? 'fa-file-image text-sky-500' : 'fa-file-pdf text-red-500';
    const meta = [esc(f.type), mine ? 'Uploaded by you' : 'Uploaded by partner HR', formatDate(f.uploadedAt), 'v' + f.version];
    if(showPath) meta.unshift('<i class="fa-solid fa-folder text-amber-400 mr-0.5"></i>' + esc(folderLabel(v, f.folder)));
    const pending = f.pending ? ' <span class="ml-1 text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">' + (f.pending === 'delete' ? 'Delete' : 'Edit') + ' request pending</span>' : '';
    const actions = f.pending ? '' : mine
      ? '<button data-file-act="rename" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-pen mr-1"></i>Rename</button>'
      + '<button data-file-act="replace" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-sky-600 bg-sky-50 hover:bg-sky-100"><i class="fa-solid fa-arrow-up-from-bracket mr-1"></i>Replace</button>'
      + '<button data-file-act="delete" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-red-600 bg-red-50 hover:bg-red-100"><i class="fa-solid fa-trash mr-1"></i>Delete</button>'
      : '<button data-file-act="request-edit" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-slate-500 bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-lock mr-1"></i>Request edit</button>'
      + '<button data-file-act="request-delete" data-id="' + f.id + '" class="' + VAULT_BTN + 'text-slate-500 bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-lock mr-1"></i>Request delete</button>';
    return '<div class="flex flex-wrap items-center justify-between gap-2 border border-slate-200 rounded-md px-3 py-2.5">'
      + '<div class="flex items-center gap-2.5 min-w-0"><i class="fa-solid ' + icon + ' flex-shrink-0"></i>'
      +   '<div class="min-w-0"><div class="text-[12.5px] text-slate-700 truncate">' + esc(f.name) + pending + '</div>'
      +   '<div class="text-[10.5px] text-slate-400">' + meta.join(' · ') + '</div></div></div>'
      + '<div class="flex items-center gap-2 flex-shrink-0">'
      +   '<button data-file-act="download" data-id="' + f.id + '" class="text-slate-400 hover:text-slate-600" aria-label="Download"><i class="fa-solid fa-download"></i></button>'
      +   actions + '</div></div>';
}
const vaultEmpty = (text) => '<div class="text-center text-[12.5px] text-slate-400 border border-dashed border-slate-200 rounded-md py-8">' + text + '</div>';

function renderVault(){
    const v = ensureVault(vaultCompany);
    if(vaultFolder && !folderById(v, vaultFolder)) vaultFolder = null;
    const crumbs = [{id: '', name: vaultCompany}].concat(folderPath(v, vaultFolder));
    document.getElementById('vaultBreadcrumb').innerHTML = crumbs.map((c, i) => i === crumbs.length - 1
        ? '<span class="font-semibold text-slate-800">' + esc(c.name) + '</span>'
        : '<button data-crumb="' + esc(c.id) + '" class="text-sky-600 hover:underline">' + esc(c.name) + '</button><i class="fa-solid fa-chevron-right text-[9px] text-slate-300 mx-1"></i>').join('');

    const q = document.getElementById('vaultSearch').value.trim().toLowerCase();
    const type = document.getElementById('vaultTypeFilter').value;
    const intern = document.getElementById('vaultInternFilter').value;
    let html;
    if(q || type || intern){
        const files = v.files.filter(f => (!q || f.name.toLowerCase().includes(q)) && (!type || f.type === type) && (!intern || internOfFolder(v, f.folder) === intern));
        html = '<div class="text-[11.5px] text-slate-400">' + files.length + ' result' + (files.length === 1 ? '' : 's') + ' across all folders</div>'
          + (files.length ? files.map(f => vaultFileRow(v, f, true)).join('') : vaultEmpty('No files match your search or filters.'));
    } else {
        const folders = v.folders.filter(f => (f.parent || null) === vaultFolder);
        const files = v.files.filter(f => f.folder === vaultFolder);
        html = folders.map(f => vaultFolderRow(v, f)).join('') + files.map(f => vaultFileRow(v, f, false)).join('');
        if(!html) html = vaultEmpty(vaultFolder === 'interns'
            ? 'No interns deployed here yet. Each intern deployed to this company gets their own folder.'
            : 'This folder is empty. Upload a signed scan to keep a copy here.');
    }
    document.getElementById('vaultFileList').innerHTML = html;
}

function fillVaultFilters(v){
    document.getElementById('vaultTypeFilter').innerHTML = '<option value="">All document types</option>' + VAULT_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
    document.getElementById('vaultInternFilter').innerHTML = '<option value="">All interns</option>' + v.folders.filter(f => f.intern).map(f => '<option>' + esc(f.intern) + '</option>').join('');
    document.getElementById('vaultUploadType').innerHTML = VAULT_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
}

function openVault(company, intern){
    vaultCompany = company;
    const v = ensureVault(company);
    const internFolder = intern ? v.folders.find(f => f.intern === intern) : null;
    vaultFolder = internFolder ? internFolder.id : null;
    document.getElementById('vaultCompanyName').textContent = company;
    document.getElementById('vaultSearch').value = '';
    fillVaultFilters(v);
    document.getElementById('vaultUploadForm').classList.add('hidden');
    renderVault();
    vaultModal.classList.remove('hidden');
}

if(vaultModal){
    document.querySelectorAll('.open-vault-btn').forEach(btn => btn.addEventListener('click', () => openVault(btn.dataset.company)));
    renderSiteLines();
    on('closeVaultModalBtn', 'click', () => vaultModal.classList.add('hidden'));
    ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => on(id, id === 'vaultSearch' ? 'input' : 'change', renderVault));

    // Quick open: any intern's folder from the directory page
    const picker = document.getElementById('internFolderPicker');
    if(picker){
        picker.innerHTML = '<option value="">Select an intern…</option>' + PARTNER_COMPANIES.map(c => {
            const names = internsOf(c);
            return names.length ? '<optgroup label="' + esc(c) + '">' + names.map(n => '<option value="' + esc(c + '|' + n) + '">' + esc(n) + '</option>').join('') + '</optgroup>' : '';
        }).join('');
        picker.addEventListener('change', () => {
            if(!picker.value) return;
            const [company, intern] = picker.value.split('|');
            picker.value = '';
            openVault(company, intern);
        });
    }

    // Deep link from Roster / Attendance: CoordinatorDirectory.html?vault=Company&intern=Name
    const params = new URLSearchParams(window.location.search);
    if(params.get('vault')) openVault(params.get('vault'), params.get('intern'));

    document.getElementById('vaultBreadcrumb').addEventListener('click', (e) => {
        const crumb = e.target.closest('[data-crumb]');
        if(!crumb) return;
        vaultFolder = crumb.dataset.crumb || null;
        renderVault();
    });

    document.getElementById('vaultFileList').addEventListener('click', (e) => {
        const open = e.target.closest('[data-open-folder]');
        if(open){
            vaultFolder = open.dataset.openFolder;
            ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => document.getElementById(id).value = '');
            renderVault();
            return;
        }
        const v = ensureVault(vaultCompany);
        const folderBtn = e.target.closest('[data-folder-act]');
        if(folderBtn){
            const folder = folderById(v, folderBtn.dataset.id);
            if(folderBtn.dataset.folderAct === 'rename'){
                const name = (prompt('Rename folder', folder.name) || '').trim();
                if(!name || name === folder.name) return;
                updateVault(vaultCompany, vt => { folderById(vt, folder.id).name = name; });
                showToast('Folder renamed to "' + name + '".', 'success');
            } else {
                if(filesUnder(v, folder.id) || subfolderIds(v, folder.id).length){ showToast('Move or delete what is inside "' + folder.name + '" first.', 'warn'); return; }
                if(!confirm('Delete the empty folder "' + folder.name + '"?')) return;
                updateVault(vaultCompany, vt => { vt.folders = vt.folders.filter(f => f.id !== folder.id); });
                showToast('Folder deleted.', 'info');
            }
            renderVault();
            return;
        }
        const fileBtn = e.target.closest('[data-file-act]');
        if(!fileBtn) return;
        const file = v.files.find(f => f.id === fileBtn.dataset.id);
        if(!file) return;
        const act = fileBtn.dataset.fileAct;
        if(act === 'download'){ showToast('Downloading "' + file.name + '"…', 'info'); return; }
        if(act === 'replace'){ replaceTargetId = file.id; document.getElementById('vaultReplaceInput').click(); return; }
        if(act === 'rename'){
            const name = (prompt('Rename file', file.name) || '').trim();
            if(!name || name === file.name) return;
            updateVault(vaultCompany, vt => { vt.files.find(f => f.id === file.id).name = name; });
            showToast('File renamed to "' + name + '".', 'success');
        }
        if(act === 'delete'){
            if(!confirm('Delete "' + file.name + '" from the vault? This cannot be undone.')) return;
            updateVault(vaultCompany, vt => { vt.files = vt.files.filter(f => f.id !== file.id); });
            showToast('"' + file.name + '" deleted.', 'info');
        }
        if(act === 'request-edit' || act === 'request-delete'){
            const kind = act === 'request-edit' ? 'edit' : 'delete';
            updateVault(vaultCompany, vt => { vt.files.find(f => f.id === file.id).pending = kind; });
            showToast(capitalize(kind) + ' request for "' + file.name + '" sent to ' + vaultCompany + "'s HR. The file stays as is until they approve.", 'info');
        }
        renderVault();
    });

    on('vaultReplaceInput', 'change', (e) => {
        const picked = e.target.files[0];
        e.target.value = '';
        if(!picked || !replaceTargetId) return;
        updateVault(vaultCompany, vt => {
            const f = vt.files.find(x => x.id === replaceTargetId);
            Object.assign(f, {name: picked.name, version: f.version + 1, uploadedAt: todayISO()});
        });
        replaceTargetId = null;
        renderVault();
        showToast('New version uploaded. The previous version is kept in the file history.', 'success');
    });

    on('vaultNewFolderBtn', 'click', () => {
        const name = (prompt('New folder name' + (vaultFolder ? ' (inside ' + folderLabel(ensureVault(vaultCompany), vaultFolder) + ')' : '')) || '').trim();
        if(!name) return;
        const v = ensureVault(vaultCompany);
        if(v.folders.some(f => (f.parent || null) === vaultFolder && f.name.toLowerCase() === name.toLowerCase())){ showToast('A folder with that name already exists here.', 'warn'); return; }
        updateVault(vaultCompany, vt => { vt.folders.push({id: 'f-' + vaultId(), name, parent: vaultFolder, system: false}); });
        renderVault();
        showToast('Folder "' + name + '" created.', 'success');
    });

    // Upload: pick the signed scan, its document type and the folder to save it in
    on('vaultUploadBtn', 'click', () => {
        const form = document.getElementById('vaultUploadForm');
        if(!form.classList.contains('hidden')){ form.classList.add('hidden'); return; }
        const v = ensureVault(vaultCompany);
        const options = v.folders.filter(f => f.id !== 'interns').map(f => ({id: f.id, label: folderLabel(v, f.id)})).sort((a, b) => a.label.localeCompare(b.label));
        const target = vaultFolder && vaultFolder !== 'interns' ? vaultFolder : 'company';
        const sel = document.getElementById('vaultUploadFolder');
        sel.innerHTML = options.map(o => '<option value="' + esc(o.id) + '"' + (o.id === target ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
        document.getElementById('vaultUploadType').value = defaultTypeFor(v, target);
        form.classList.remove('hidden');
    });
    on('vaultUploadFolder', 'change', (e) => { document.getElementById('vaultUploadType').value = defaultTypeFor(ensureVault(vaultCompany), e.target.value); });
    on('vaultUploadCancel', 'click', () => document.getElementById('vaultUploadForm').classList.add('hidden'));
    on('vaultUploadSave', 'click', () => {
        const input = document.getElementById('vaultFileInput');
        const picked = input.files[0];
        if(!picked){ showToast('Choose the signed scan to upload first.', 'warn'); return; }
        const folder = document.getElementById('vaultUploadFolder').value;
        const type = document.getElementById('vaultUploadType').value;
        updateVault(vaultCompany, vt => { vt.files.push({id: vaultId(), name: picked.name, folder, type, owner: 'coordinator', uploadedAt: todayISO(), version: 1}); });
        input.value = '';
        document.getElementById('vaultUploadForm').classList.add('hidden');
        vaultFolder = folder;
        ['vaultSearch', 'vaultTypeFilter', 'vaultInternFilter'].forEach(id => document.getElementById(id).value = '');
        renderVault();
        showToast('Uploaded to ' + folderLabel(ensureVault(vaultCompany), folder).replace(/\.$/, '') + '.', 'success');
    });
}


/* ============ Placements Page ============ */

const NEXT_STEP = {
    'Not placed': ['apply', 'Record application'],
    'Applied': ['endorse', 'Mark endorsed'],
    'Endorsed': ['accept', 'Mark accepted'],
    'Accepted': ['deploy', 'Confirm deployment']
};
const AFTER_STEP = {'Deployed': 'Monitoring attendance', 'Hours complete': 'Ready to mark completed', 'Completed': 'Alumni', 'Withdrawn': 'Withdrawn'};
const placementOrder = (p) => { const i = PLACEMENT_STEPS.indexOf(p.status); return i < 0 ? 99 : i; };

function scanChip(p, type, label){
    const ok = hasDoc(p.company, p.name, type);
    return '<span class="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border '
      + (ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-400 bg-slate-50 border-slate-200') + '" title="' + (ok ? 'Signed scan is in the vault' : 'No signed scan yet') + '">'
      + '<i class="fa-solid ' + (ok ? 'fa-check' : 'fa-minus') + ' text-[9px]"></i>' + label + '</span>';
}
function placementRow(p){
    const next = NEXT_STEP[p.status];
    const action = next
        ? '<button data-pl-act="' + next[0] + '" class="text-[11.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-2.5 py-1 rounded-md transition whitespace-nowrap">' + next[1] + '</button>'
          + (['Applied', 'Endorsed', 'Accepted'].includes(p.status) ? '<button data-pl-act="decline" class="ml-2 text-[11px] text-slate-500 hover:text-red-600 whitespace-nowrap">Not accepted</button>' : '')
        : '<span class="text-[11.5px] text-slate-400">' + (p.status === 'Hours complete' ? (hasDoc(p.company, p.name, 'Supervisor evaluation') ? 'Ready to mark completed in the Roster' : 'Needs supervisor evaluation') : (AFTER_STEP[p.status] || '')) + '</span>';
    return '<tr data-name="' + esc(p.name) + '">'
      + '<td class="px-5 py-3"><a href="' + profileLink(p.name) + '" class="font-medium text-slate-900 hover:text-sky-700 hover:underline whitespace-nowrap">' + esc(p.name) + '</a>'
      + (p.studentNo ? '<div class="text-[10.5px] text-slate-400">' + esc(p.studentNo) + '</div>' : '') + '</td>'
      + '<td class="px-5 py-3 text-[13px] text-slate-600">' + (p.company ? esc(p.company) : '<span class="text-slate-400">—</span>') + '</td>'
      + '<td class="px-5 py-3">' + placementBadge(p.status) + '</td>'
      + '<td class="px-5 py-3"><div class="flex gap-1.5 flex-wrap">' + scanChip(p, 'Endorsement letter', 'Endorsement') + scanChip(p, 'Acceptance letter', 'Acceptance') + '</div></td>'
      + '<td class="px-5 py-3">' + action + '</td>'
      + '<td class="px-5 py-3 text-right whitespace-nowrap">'
      + (p.company ? '<button data-pl-act="files" class="text-[11.5px] font-medium text-slate-500 hover:text-sky-700"><i class="fa-solid fa-folder-open mr-1"></i>Files</button>' : '')
      + '<a href="' + profileLink(p.name) + '" class="ml-3 text-[11.5px] font-medium text-sky-600 hover:text-sky-700">Profile</a></td></tr>';
}

let placementStage = new URLSearchParams(window.location.search).get('stage') || '';
function renderPlacements(){
    const all = placementList();
    document.getElementById('placementStages').innerHTML = [''].concat(PLACEMENT_STEPS).map(stage => {
        const n = stage ? all.filter(p => p.status === stage).length : all.length;
        return '<button data-stage="' + stage + '" class="text-left rounded-lg border px-3 py-2 transition ' + (stage === placementStage ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300') + '">'
          + '<div class="text-[10.5px] text-slate-500 truncate">' + (stage || 'All students') + '</div><div class="text-lg font-bold text-slate-900 leading-tight">' + n + '</div></button>';
    }).join('');
    const q = document.getElementById('placementSearch').value.toLowerCase().trim();
    const list = all.filter(p => (!placementStage || p.status === placementStage) && (!q || (p.name + ' ' + p.company).toLowerCase().includes(q)))
        .sort((a, b) => placementOrder(a) - placementOrder(b) || a.name.localeCompare(b.name));
    document.getElementById('placementTbody').innerHTML = list.map(placementRow).join('');
    list.forEach((p, i) => { if(p.source === 'student') document.getElementById('placementTbody').children[i]?.querySelector('td')?.insertAdjacentHTML('beforeend', '<span class="ml-1 text-[9.5px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">by student</span>'); });
    document.getElementById('placementEmpty').classList.toggle('hidden', list.length > 0);
}

// Moves a student one step; endorse and accept need the signed scan in the vault first
let applyTarget = '';
function placementAction(name, act){
    const p = placementList().find(x => x.name === name);
    if(!p) return;
    const history = (status, note) => (p.history || []).concat(note ? {status, date: todayISO(), note} : {status, date: todayISO()});
    const needScan = (type) => {
        if(hasDoc(p.company, p.name, type)) return false;
        if(confirm('There is no signed ' + type.toLowerCase() + ' scan in ' + p.name + "'s vault folder yet.\n\nOpen the folder to upload it?")) openInternFiles(p.company, p.name);
        return true;
    };
    if(act === 'files'){ openInternFiles(p.company, p.name); return; }
    if(act === 'apply'){
        applyTarget = name;
        document.getElementById('applyName').textContent = 'Where did ' + name + ' apply?';
        document.getElementById('applyCompany').innerHTML = PARTNER_COMPANIES.map(c => '<option>' + esc(c) + '</option>').join('');
        openModal(document.getElementById('applyModal'));
        return;
    }
    if(act === 'endorse'){
        if(needScan('Endorsement letter')) return;
        savePlacement(name, {status: 'Endorsed', history: history('Endorsed')});
        logAudit('Marked ' + name + ' as endorsed to ' + p.company);
        showToast(esc(name) + ' marked as endorsed to ' + esc(p.company) + '.', 'success');
    }
    if(act === 'accept'){
        if(needScan('Acceptance letter')) return;
        savePlacement(name, {status: 'Accepted', history: history('Accepted')});
        logAudit('Marked ' + name + ' as accepted by ' + p.company);
        showToast(esc(name) + ' was accepted by ' + esc(p.company) + '. Confirm deployment when they start.', 'success');
    }
    if(act === 'deploy'){
        openScheduleModal(p, 'Confirm deployment of ' + name, (sched) => {
            savePlacement(name, {status: 'Deployed', deployedAt: todayISO(), hours: p.hours || 0, schedule: sched, history: history('Deployed')});
            if(p.real) updateUser(p.email, 'student', {company: p.company});
            logAudit('Confirmed deployment of ' + name + ' to ' + p.company + ' (' + scheduleText(sched) + ')');
            showToast(esc(name) + ' is now deployed and appears in the Roster. Attendance monitoring starts today.', 'success');
            renderPlacements();
        });
        return;
    }
    if(act === 'decline'){
        if(!confirm(p.company + ' did not accept ' + name + '? The student goes back to Not placed. Files in the vault are kept.')) return;
        savePlacement(name, {status: 'Not placed', company: '', history: history('Not placed', 'Not accepted by ' + p.company)});
        showToast(esc(name) + ' is back to Not placed.', 'warn');
    }
    renderPlacements();
}

if(document.getElementById('placementTbody')){
    renderPlacements();
    on('placementSearch', 'input', renderPlacements);
    document.getElementById('placementStages').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-stage]');
        if(!btn) return;
        placementStage = btn.dataset.stage;
        renderPlacements();
    });
    document.getElementById('placementTbody').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pl-act]');
        if(btn) placementAction(btn.closest('tr').dataset.name, btn.dataset.plAct);
    });
    const applyModal = document.getElementById('applyModal');
    on('applyCloseBtn', 'click', () => closeModal(applyModal));
    on('applyCancelBtn', 'click', () => closeModal(applyModal));
    on('applySaveBtn', 'click', () => {
        const p = placementList().find(x => x.name === applyTarget);
        const company = document.getElementById('applyCompany').value;
        savePlacement(applyTarget, {status: 'Applied', company, history: (p.history || []).concat({status: 'Applied', date: todayISO(), note: company})});
        closeModal(applyModal);
        renderPlacements();
        showToast(esc(applyTarget) + "'s application to " + esc(company) + ' recorded. Upload the signed endorsement letter to their vault folder.', 'success');
    });
}


/* ============ Intern Profile ============ */

const CHECKLIST_KEY = 'ic_checklist';
const REQUIREMENTS = [
    ['Endorsement letter', 'Needed before endorsement'],
    ['Acceptance letter', 'Needed before deployment'],
    ['DTR / attendance', 'During the OJT'],
    ['Supervisor evaluation', 'At the end of the OJT']
];
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
const ATT_BADGE = {
    'Present': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Late': 'text-amber-700 bg-amber-50 border-amber-200',
    'Absent': 'text-slate-500 bg-slate-100 border-slate-200',
    'Flagged': 'text-red-600 bg-red-50 border-red-200',
    'Outside schedule': 'text-indigo-700 bg-indigo-50 border-indigo-200',
    'Holiday': 'text-violet-700 bg-violet-50 border-violet-200',
    'Clocked in': 'text-sky-700 bg-sky-50 border-sky-200'
};
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
    const last = worked[0];
    const stat = (label, value, sub, tone) => '<div class="rounded-lg border border-slate-200 px-3 py-2.5"><div class="text-[10.5px] text-slate-500">' + label + '</div>'
        + '<div class="text-lg font-bold leading-tight ' + (tone || 'text-slate-900') + '">' + value + '</div>' + (sub ? '<div class="text-[10.5px] text-slate-400 truncate">' + sub + '</div>' : '') + '</div>';
    const summary = '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">'
        + stat('Days present', worked.length, 'of ' + workDays + ' working days' + (count('Holiday') ? ' · ' + count('Holiday') + ' holiday' + (count('Holiday') > 1 ? 's' : '') : ''))
        + stat('Hours rendered', p.hours || 0, 'of ' + REQUIRED_HOURS + (rejected ? ' · ' + rejected + ' rejected' : ''))
        + stat('Late', count('Late'), 'after ' + fmtClock(clockMins(scheduleOf(p).timeIn) + scheduleOf(p).grace), count('Late') ? 'text-amber-600' : '')
        + stat('Absent', count('Absent'), 'no clock-in', count('Absent') ? 'text-slate-700' : '')
        + stat('Flagged', flagsPending, flagsPending ? 'needs your review' : 'all reviewed', flagsPending ? 'text-red-600' : '')
        + stat('Last clock-in', formatDate(last.date).replace(/, \d{4}$/, ''), fmtClock(last.timeIn))
        + '</div>';

    const chips = [['', 'All'], ['Late', 'Late'], ['Absent', 'Absent'], ['Flagged', 'Flagged']].map(([f, label]) =>
        '<button data-pf-act="att-filter" data-f="' + f + '" class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ' + (attFilter === f ? 'bg-sky-600 text-white border-sky-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50') + '">' + label + '</button>').join('');
    const right = '<div class="flex items-center gap-1.5 flex-wrap">' + chips
        + '<button data-pf-act="att-export" class="ml-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-md"><i class="fa-solid fa-file-csv mr-1"></i>Export CSV</button></div>';

    const list = recs.filter(r => !attFilter || r.status === attFilter);
    const shown = attShowAll ? list : list.slice(0, 10);
    const photo = (r, kind) => '<button data-pf-act="att-photo" data-date="' + r.date + '" data-kind="' + kind + '" class="flex items-center gap-2 group" title="View photo and location">'
        + '<img src="' + clockPhoto(p, r, kind) + '" alt="' + (kind === 'in' ? 'Clock-in' : 'Clock-out') + ' photo" class="w-7 h-9 rounded object-cover border border-slate-200 group-hover:ring-2 group-hover:ring-sky-300">'
        + '<span class="text-[12px] text-slate-700">' + fmtClock(kind === 'in' ? r.timeIn : r.timeOut) + '</span></button>';
    const review = (r) => r.status !== 'Flagged' ? ''
        : !r.review ? '<button data-pf-act="att-accept" data-date="' + r.date + '" class="text-[10.5px] font-semibold text-emerald-700 hover:text-emerald-800">Accept</button><button data-pf-act="att-reject" data-date="' + r.date + '" class="ml-2 text-[10.5px] font-semibold text-red-600 hover:text-red-700">Reject</button>'
        : '<span class="text-[10.5px] font-semibold ' + (r.review === 'accepted' ? 'text-emerald-700' : 'text-red-600') + '">' + (r.review === 'accepted' ? 'Accepted' : 'Rejected') + '</span><button data-pf-act="att-undo" data-date="' + r.date + '" class="ml-2 text-[10.5px] text-slate-400 hover:text-slate-600">Undo</button>';
    const rows = shown.map(r => {
        const absent = r.status === 'Absent' || r.status === 'Holiday';
        const where = r.status === 'Holiday' ? '<span class="text-violet-700">' + esc(r.place) + '</span>' : absent ? '—' : r.remote ? '<span class="text-slate-600">' + r.place + '</span>'
            : '<div class="text-slate-600">' + esc(r.place) + '</div><div class="text-[10.5px] ' + (r.dist > (r.radius || GEOFENCE_M) ? 'text-red-500' : 'text-slate-400') + '">' + (r.dist > (r.radius || GEOFENCE_M) ? 'Outside geofence · ' : 'Inside geofence · ') + r.dist + ' m</div>';
        return '<tr' + (r.status === 'Flagged' && !r.review ? ' class="bg-red-50/40"' : '') + '>'
          + '<td class="px-3 py-2 text-[12px] text-slate-700 whitespace-nowrap">' + formatDate(r.date) + '<div class="text-[10.5px] text-slate-400">' + new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'short'}) + '</div></td>'
          + '<td class="px-3 py-2">' + (absent ? '<span class="text-[12px] text-slate-400">—</span>' : photo(r, 'in')) + '</td>'
          + '<td class="px-3 py-2">' + (absent ? '<span class="text-[12px] text-slate-400">—</span>' : photo(r, 'out')) + '</td>'
          + '<td class="px-3 py-2 text-[12px]">' + where + '</td>'
          + '<td class="px-3 py-2 text-[12px] font-medium whitespace-nowrap ' + (r.review === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-700') + '">' + (r.status === 'Holiday' ? '—' : r.hours + ' hrs') + (r.review === 'rejected' ? '<div class="text-[10px] font-normal text-red-500 no-underline">not counted</div>' : '') + '</td>'
          + '<td class="px-3 py-2"><span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + ATT_BADGE[r.status] + '">' + r.status + '</span></td>'
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
    const row = (label, value) => '<div class="flex justify-between gap-3 py-1.5 text-[12.5px]"><span class="text-slate-500">' + label + '</span><span class="text-slate-800 text-right">' + value + '</span></div>';
    document.getElementById('attPhotoTitle').textContent = (kind === 'in' ? 'Clock-in' : 'Clock-out') + ' · ' + formatDate(date);
    document.getElementById('attPhotoBody').innerHTML = '<div class="flex gap-4">'
        + '<img src="' + clockPhoto(p, r, kind) + '" alt="Live camera photo" class="w-32 h-40 rounded-lg object-cover border border-slate-200 flex-shrink-0">'
        + '<div class="flex-1 min-w-0 divide-y divide-slate-100">'
        + row('Intern', esc(p.name))
        + row('Server timestamp', formatDate(date) + ' ' + fmtClock(kind === 'in' ? r.timeIn : r.timeOut))
        + row('Photo', 'Live camera capture')
        + row('Location', r.remote ? 'Remote (work from home)' : esc(r.place))
        + row('GPS', '<a target="_blank" rel="noopener" class="text-sky-600 hover:underline" href="https://www.google.com/maps?q=' + r.lat + ',' + r.lng + '">' + r.lat + ', ' + r.lng + '</a>')
        + row('Geofence', r.remote ? 'Not required (remote day)' : r.dist > (r.radius || GEOFENCE_M) ? '<span class="text-red-600 font-medium">Outside · ' + r.dist + ' m away</span>' : '<span class="text-emerald-700 font-medium">Inside · ' + r.dist + ' m away</span>')
        + row('Hours that day', r.hours + ' hrs')
        + '</div></div>';
    openModal(document.getElementById('attPhotoModal'));
}
function exportAttendanceCsv(p){
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Time in', 'Time out', 'Location', 'Latitude', 'Longitude', 'Distance from site (m)', 'Hours', 'Status', 'Review']]
        .concat(internAttendance(p).slice().reverse().map(r => [r.date, r.timeIn ? fmtClock(r.timeIn) : '', r.timeOut ? fmtClock(r.timeOut) : '', r.place || '', r.lat || '', r.lng || '', r.dist == null ? '' : r.dist, r.hours, r.status, r.review || '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.map(l => l.map(cell).join(',')).join('\r\n')], {type: 'text/csv'}));
    a.download = 'Attendance_' + fileSlug(p.name) + '.csv';
    a.click();
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
      + '<div class="w-12 h-12 rounded-full bg-sky-100 text-sky-700 font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
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

    const deletion = getDeletionRequests().find(r => r.name === p.name && r.status === 'processed');
    const deletedNote = deletion ? '<div class="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-[12.5px] text-slate-600"><i class="fa-solid fa-user-slash mr-1.5 text-slate-400"></i>Profile, resume and job-matching data were deleted on ' + formatDate(deletion.processedAt) + ' at the alumni\'s request. This OJT record is read-only and kept until ' + retainUntil(alumniCompletedAt(p)) + '.</div>' : '';
    box.innerHTML = header + deletedNote + progress + attendanceCard(p, deployed)
      + '<div class="grid lg:grid-cols-2 gap-4"><div class="space-y-4">' + hours + scheduleCard(p, deployed) + profileCard('Daily logs and reports', logBody) + '</div>'
      + '<div class="space-y-4">' + requirements + timeline + '</div></div>';
}

if(document.getElementById('internProfile')){
    const profileName = new URLSearchParams(window.location.search).get('name') || '';
    renderProfile(profileName);
    if(window.location.hash === '#attendance') document.getElementById('attendance')?.scrollIntoView();
    on('attPhotoClose', 'click', () => closeModal(document.getElementById('attPhotoModal')));
    on('profileBackBtn', 'click', () => { if(history.length > 1) history.back(); else goTo('attendance'); });
    document.getElementById('internProfile').addEventListener('click', (e) => {
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
            if(act === 'att-export'){ exportAttendanceCsv(p); return; }
            if(act === 'att-filter'){ attFilter = btn.dataset.f; attShowAll = false; }
            if(act === 'att-all') attShowAll = !attShowAll;
            if(['att-accept', 'att-reject', 'att-undo'].includes(act)){
                const reviews = getJSON(ATT_REVIEW_KEY, {});
                const key = p.name + '|' + btn.dataset.date;
                if(act === 'att-undo') delete reviews[key];
                else { reviews[key] = act === 'att-accept' ? 'accepted' : 'rejected'; showToast('Clock-in on ' + formatDate(btn.dataset.date) + (act === 'att-accept' ? ' accepted.' : ' rejected.'), act === 'att-accept' ? 'success' : 'warn'); }
                if(act !== 'att-undo') logAudit((act === 'att-accept' ? 'Accepted' : 'Rejected') + ' flagged clock-in of ' + p.name + ' on ' + btn.dataset.date, act === 'att-accept' ? 'Verified' : 'Flagged');
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


/* ============ Alumni Deletion Requests ============ */

// Approve deletes profile, resume and job-matching data; the OJT record stays (read-only) for 5 years after completion.
// Hold is for alumni whose OJT record is still incomplete. Prototype storage: ic_deletion_requests
// [{name, requestedAt, status: pending|held|processed, holdReason, heldAt, processedAt}]
function getDeletionRequests(){
    if(!localStorage.getItem(DELETION_KEY)){
        const checks = getJSON(CHECKLIST_KEY, {});
        REQUIREMENTS.forEach(([type]) => { checks['Mara L.|' + type] = checks['Mara L.|' + type] || '2026-03-14'; });
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checks));
        localStorage.setItem(DELETION_KEY, JSON.stringify([
            {name: 'Mara L.', requestedAt: '2026-10-05', status: 'pending'},
            {name: 'Rico S.', requestedAt: '2026-10-06', status: 'pending'},
            {name: 'Paolo G.', completedAt: '2021-03-12', requestedAt: '2021-04-02', status: 'processed', processedAt: '2021-04-05'}
        ]));
    }
    // When the retention period ends, the kept OJT record is anonymized (name and personal details removed)
    const list = getJSON(DELETION_KEY, []);
    let changed = false;
    list.forEach(r => {
        if(r.status !== 'processed' || !r.completedAt) return;
        if(plusYears(r.completedAt, 5) > todayISO()) return;
        logAudit('Anonymized an OJT record (completed ' + r.completedAt + ') after the 5-year retention period', 'Anonymized', true);
        Object.assign(r, {status: 'anonymized', anonymizedAt: todayISO(), hash: nameHash(r.name), name: 'Anonymized record ' + (list.indexOf(r) + 1)});
        changed = true;
    });
    const anon = getJSON(ANON_KEY, []);
    list.filter(r => r.status === 'anonymized' && r.hash && !anon.includes(r.hash)).forEach(r => anon.push(r.hash));
    placementList().filter(p => p.status === 'Completed' && plusYears(alumniCompletedAt(p), 5) <= todayISO()).forEach(p => {
        const done = alumniCompletedAt(p);
        anon.push(nameHash(p.name));
        list.push({name: 'Anonymized record ' + (list.length + 1), completedAt: done, status: 'anonymized', anonymizedAt: todayISO(), auto: true});
        logAudit('Anonymized an OJT record (completed ' + done + ') after the 5-year retention period', 'Anonymized', true);
        changed = true;
    });
    localStorage.setItem(ANON_KEY, JSON.stringify(anon));
    if(changed) localStorage.setItem(DELETION_KEY, JSON.stringify(list));
    return list;
}
function saveDeletionRequest(name, patch){
    localStorage.setItem(DELETION_KEY, JSON.stringify(getDeletionRequests().map(r => r.name === name ? Object.assign({}, r, patch) : r)));
}
function alumniCompletedAt(p){ return ((p.history || []).filter(h => h.status === 'Completed').pop() || {date: todayISO()}).date; }

// What still has to be done before the OJT record can be archived
function recordGaps(p){
    const checks = getJSON(CHECKLIST_KEY, {});
    const docs = internDocs(p.company, p.name);
    const gaps = [];
    REQUIREMENTS.forEach(([type]) => {
        if(!docs.some(f => f.type === type)) gaps.push('Missing ' + type.toLowerCase());
        else if(!checks[p.name + '|' + type]) gaps.push(type + ' not verified');
    });
    if((p.hours || 0) < REQUIRED_HOURS) gaps.push('Hours incomplete (' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + ')');
    if(pendingFlags(p)) gaps.push(pendingFlags(p) + ' flagged clock-in(s) not reviewed');
    return gaps;
}

let holdFormFor = '';
function deletionCard(r){
    if(r.status === 'anonymized') return '<div class="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap"><div class="flex items-center gap-3">'
        + '<div class="w-9 h-9 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center"><i class="fa-solid fa-user-secret"></i></div>'
        + '<div><div class="font-semibold text-slate-700 text-sm">' + esc(r.name) + '</div><div class="text-[11.5px] text-slate-400">Completed ' + formatDate(r.completedAt) + ' · retention ended ' + retainUntil(r.completedAt) + (r.auto ? ' · no deletion request' : '') + '</div></div></div>'
        + '<span class="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">Anonymized ' + formatDate(r.anonymizedAt) + '</span>'
        + '<p class="w-full text-[11.5px] text-slate-500">The kept OJT record reached the end of its retention period. Name, photos, GPS and signed scans were removed; only anonymous counts remain for reports.</p></div>';
    const p = placementList().find(x => x.name === r.name) || {name: r.name, history: []};
    const done = r.completedAt || alumniCompletedAt(p), keep = retainUntil(done);
    const initials = r.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const head = '<div class="flex items-center justify-between gap-3 flex-wrap"><div class="flex items-center gap-3">'
        + '<div class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-[12px] font-semibold flex items-center justify-center">' + esc(initials) + '</div>'
        + '<div><div class="font-semibold text-slate-900 text-sm"><a href="' + profileLink(r.name) + '" class="hover:text-sky-700">' + esc(r.name) + '</a> <span class="text-slate-400 font-normal">(Alumni)</span></div>'
        + '<div class="text-[11.5px] text-slate-400">Completed ' + formatDate(done) + ' · requested ' + formatDate(r.requestedAt) + '</div></div></div>';
    if(r.status === 'processed') return '<div class="bg-slate-50 rounded-xl border border-slate-200 p-4">' + head
        + '<span class="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">Deleted ' + formatDate(r.processedAt) + '</span></div>'
        + '<p class="text-[11.5px] text-slate-500 mt-3">Profile, resume and job-matching data deleted. OJT record (hours, attendance photos and GPS, approved logs, signed scans) kept read-only until <strong class="text-slate-700">' + keep + '</strong>.</p></div>';

    const gaps = recordGaps(p);
    const btn = 'text-[12px] font-semibold px-3 py-1.5 rounded-md transition ';
    const approve = '<button data-del-act="approve" data-name="' + esc(r.name) + '" ' + (gaps.length ? 'disabled title="Complete the OJT record first"' : '') + ' class="' + btn + (gaps.length ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-white bg-emerald-500 hover:bg-emerald-600') + '"><i class="fa-solid fa-check mr-1"></i>Approve deletion</button>';
    const actions = r.status === 'held'
        ? '<span class="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><i class="fa-solid fa-pause mr-1"></i>On hold</span>' + approve
          + '<button data-del-act="resume" data-name="' + esc(r.name) + '" class="' + btn + 'text-slate-600 border border-slate-200 hover:bg-slate-50">Remove hold</button>'
        : approve + '<button data-del-act="hold" data-name="' + esc(r.name) + '" class="' + btn + 'text-amber-700 bg-amber-50 hover:bg-amber-100"><i class="fa-solid fa-pause mr-1"></i>Hold</button>';

    const checklist = '<div class="mt-3 rounded-md border px-3 py-2 ' + (gaps.length ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60') + '">'
        + (gaps.length
            ? '<div class="text-[11.5px] font-semibold text-amber-800 mb-1">Incomplete OJT record</div><ul class="text-[11.5px] text-amber-800 space-y-0.5">' + gaps.map(g => '<li><i class="fa-solid fa-circle-exclamation mr-1.5 text-[10px]"></i>' + esc(g) + '</li>').join('') + '</ul>'
              + '<a href="' + profileLink(r.name) + '" class="inline-block mt-1.5 text-[11.5px] font-semibold text-sky-700 hover:underline">Open profile to complete →</a>'
            : '<div class="text-[11.5px] font-semibold text-emerald-800"><i class="fa-solid fa-circle-check mr-1.5"></i>OJT record complete. Ready for deletion.</div>')
        + '</div>';
    const held = r.status === 'held' ? '<div class="mt-2 text-[11.5px] text-slate-600 bg-slate-50 rounded-md px-3 py-2"><span class="font-semibold text-slate-700">Hold reason (' + formatDate(r.heldAt) + '):</span> ' + esc(r.holdReason) + '<div class="text-[10.5px] text-slate-400 mt-0.5">The alumni sees this reason.</div></div>' : '';
    const form = holdFormFor === r.name ? '<div class="mt-3"><label class="text-[11.5px] font-medium text-slate-600 block mb-1">Reason for the hold (shown to the alumni)</label>'
        + '<textarea id="holdReasonInput" rows="2" class="w-full border border-slate-300 rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-sky-400">' + esc(gaps.length ? 'Your OJT record is still incomplete: ' + gaps.join('; ') + '.' : '') + '</textarea>'
        + '<div class="flex justify-end gap-2 mt-2"><button data-del-act="hold-cancel" class="text-[12px] font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancel</button>'
        + '<button data-del-act="hold-save" data-name="' + esc(r.name) + '" class="text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-md">Save hold</button></div></div>' : '';
    return '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">' + head + '<div class="flex gap-2 flex-shrink-0 items-center flex-wrap">' + actions + '</div></div>'
        + checklist + held + form
        + '<p class="text-[11.5px] text-slate-500 mt-3">Profile, resume and job-matching data will be deleted. The OJT record (hours, attendance photos and GPS, approved logs, signed scans) is kept read-only until <strong class="text-slate-700">' + keep + '</strong> (5 years after completion).</p></div>';
}
function renderDeletionRequests(){
    const all = getDeletionRequests();
    const open = all.filter(r => r.status !== 'processed'), processed = all.filter(r => r.status === 'processed');
    document.getElementById('wr-deletions').innerHTML = (open.length ? open.map(deletionCard).join('') : '<p class="text-[12.5px] text-slate-400">No open deletion requests.</p>')
        + (processed.length ? '<div class="pt-3 space-y-2.5"><div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Processed</div>' + processed.map(deletionCard).join('') + '</div>' : '');
    updateRequestCounts();
}
if(document.getElementById('wr-deletions')){
    renderDeletionRequests();
    document.getElementById('wr-deletions').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-del-act]');
        if(!btn || btn.disabled) return;
        const act = btn.dataset.delAct, name = btn.dataset.name;
        if(act === 'hold'){ holdFormFor = name; }
        if(act === 'hold-cancel'){ holdFormFor = ''; }
        if(act === 'hold-save'){
            const reason = document.getElementById('holdReasonInput').value.trim();
            if(!reason){ showToast('Add a reason for the hold.', 'warn'); return; }
            saveDeletionRequest(name, {status: 'held', holdReason: reason, heldAt: todayISO()});
            logAudit('Put the deletion request of ' + name + ' on hold: ' + reason, 'Hold');
            holdFormFor = '';
            showToast('Request of ' + esc(name) + ' is on hold. The alumni will see the reason.', 'warn');
        }
        if(act === 'resume'){ saveDeletionRequest(name, {status: 'pending', holdReason: '', heldAt: ''}); logAudit('Removed the hold on the deletion request of ' + name); }
        if(act === 'approve'){
            const p = placementList().find(x => x.name === name);
            if(!confirm('Delete the profile, resume and job-matching data of ' + name + '?\n\nThe OJT record stays read-only until ' + retainUntil(alumniCompletedAt(p)) + '. This cannot be undone.')) return;
            saveDeletionRequest(name, {status: 'processed', processedAt: todayISO(), completedAt: alumniCompletedAt(p)});
            logAudit('Deleted the profile, resume and job-matching data of ' + name + ' (OJT record kept until ' + retainUntil(alumniCompletedAt(p)) + ')', 'Deleted');
            showToast('Profile data of ' + esc(name) + ' deleted. OJT record kept until ' + retainUntil(alumniCompletedAt(p)) + '.', 'success');
        }
        renderDeletionRequests();
    });
}


/* ============ Audit Trail ============ */

const AUDIT_BADGE = {Success: 'text-emerald-700 bg-emerald-50', Verified: 'text-emerald-700 bg-emerald-50', Flagged: 'text-amber-600 bg-amber-50', Hold: 'text-amber-600 bg-amber-50', Deleted: 'text-slate-600 bg-slate-100', Anonymized: 'text-slate-600 bg-slate-100'};
if(document.getElementById('auditTbody')){
    getDeletionRequests();
    document.getElementById('auditTbody').insertAdjacentHTML('afterbegin', getJSON(AUDIT_KEY, []).slice().reverse().map(a => '<tr>'
        + '<td class="px-5 py-3 text-slate-500 font-mono text-[11.5px] whitespace-nowrap">' + esc(a.at) + '</td><td class="px-5 py-3 text-slate-600">' + esc(a.user) + '</td>'
        + '<td class="px-5 py-3 text-slate-700">' + esc(a.action) + '</td><td class="px-5 py-3 text-slate-500 font-mono text-[11.5px]">' + esc(a.ip) + '</td>'
        + '<td class="px-5 py-3"><span class="text-[11px] font-medium px-2 py-0.5 rounded-full ' + (AUDIT_BADGE[a.status] || AUDIT_BADGE.Success) + '">' + esc(a.status) + '</span></td></tr>').join(''));
}


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
        if(internAtRisk(p)) add('fa-triangle-exclamation', 'red', who + ' is at risk: ' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + ' hours', profileLink(p.name));
        if(p.status === 'Hours complete') add('fa-clipboard-check', 'amber', hasDoc(p.company, p.name, 'Supervisor evaluation') ? who + ' is ready to mark completed' : who + ' finished the hours. Upload the supervisor evaluation', hasDoc(p.company, p.name, 'Supervisor evaluation') ? pages.roster : profileLink(p.name));
    });
    return items;
}
const TONE = {sky: 'bg-sky-50 text-sky-600', slate: 'bg-slate-100 text-slate-500', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-500', amber: 'bg-amber-50 text-amber-600'};

function renderOverview(){
    getDeletionRequests();
    const all = placementList();
    const active = all.filter(p => ['Deployed', 'Hours complete'].includes(p.status));
    const inBatch = all.filter(p => !['Completed', 'Withdrawn'].includes(p.status));
    const avg = active.length ? Math.round(active.reduce((t, p) => t + (p.hours || 0), 0) / active.length) : 0;
    const flags = active.reduce((t, p) => t + pendingFlags(p), 0);
    const withInterns = PARTNER_COMPANIES.filter(c => active.some(p => p.company === c)).length;
    const card = (href, value, label, sub, icon, tone) => '<a href="' + href + '" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-sky-300 transition">'
        + '<div class="flex items-center justify-between"><div class="text-2xl font-extrabold text-slate-900">' + value + '</div><div class="w-9 h-9 rounded-lg ' + tone + ' flex items-center justify-center"><i class="fa-solid ' + icon + '"></i></div></div>'
        + '<div class="text-[12.5px] text-slate-500 mt-1">' + label + '</div><div class="text-[11px] text-slate-400">' + sub + '</div></a>';
    document.getElementById('overviewStats').innerHTML =
        card(pages.attendance, active.length, 'Deployed interns', 'of ' + inBatch.length + ' students in this batch', 'fa-user-graduate', 'bg-sky-50 text-sky-600')
        + card(pages.attendance, flags, 'Flagged clock-ins', flags ? 'outside the geofence, needs review' : 'all reviewed', 'fa-location-crosshairs', flags ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500')
        + '<a href="' + pages.attendance + '" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-sky-300 transition col-span-2 sm:col-span-1"><div class="text-[12.5px] text-slate-500 mb-1.5">Average rendered hours</div>'
        + '<div class="text-lg font-bold text-slate-900 mb-1.5">' + avg + ' <span class="text-[12px] font-medium text-slate-400">/ ' + REQUIRED_HOURS + ' hrs</span></div>'
        + '<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-sky-600" style="width:' + Math.min(100, Math.round(avg / REQUIRED_HOURS * 100)) + '%"></div></div><div class="text-[11px] text-slate-400 mt-1.5">deployed interns only</div></a>'
        + card(pages.partners, PARTNER_COMPANIES.length, 'Partner companies', withInterns + ' with deployed interns', 'fa-handshake', 'bg-emerald-50 text-emerald-500');
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
if(document.getElementById('overviewPipeline')) renderOverview();


/* ============ Alumni Status Requests (shared local prototype storage) ============ */
const ALUMNI_REQUEST_KEY = 'ic_alumni_requests';
function getAlumniRequests(){ return getJSON(ALUMNI_REQUEST_KEY, []); }
function saveAlumniRequests(list){ localStorage.setItem(ALUMNI_REQUEST_KEY, JSON.stringify(list)); }
function currentCoordinator(){ return getJSON('ic_session', null) || {}; }

function alumniRequestCard(req){
    const date = req.requestedAt ? new Date(req.requestedAt).toLocaleString([], {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'}) : '—';
    return `<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4" data-alumni-request-email="${esc(req.email)}">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[12px] font-semibold flex-shrink-0">${esc((req.studentName || '?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</div>
        <div class="min-w-0">
          <div class="font-semibold text-slate-900 text-sm truncate">${esc(req.studentName || req.email)}</div>
          <div class="text-[11.5px] text-slate-400 truncate">${esc(req.email)} · ${esc(req.program || '')}</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Requested ${esc(date)} · ${esc(req.classCode || '')}</div>
        </div>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <button class="alumni-approve text-[12px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-check mr-1"></i>Approve</button>
        <button class="alumni-reject text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition"><i class="fa-solid fa-xmark mr-1"></i>Reject</button>
      </div>
    </div>`;
}

function renderAlumniRequestSection(){
    const marker = document.getElementById('alumniRequestSection');
    const wr = document.getElementById('wr-students');
    if(!wr && !marker) return;
    const me = currentCoordinator();
    if(me.role !== 'coordinator') return;
    const filtered = getAlumniRequests().filter(r => r.status === 'pending' && (!r.coordinatorEmail || r.coordinatorEmail === me.email));
    if(marker){
        marker.querySelector('[data-alumni-count]').textContent = '(' + filtered.length + ')';
        const list = marker.querySelector('[data-alumni-list]');
        list.innerHTML = filtered.length ? filtered.map(alumniRequestCard).join('') : '<p class="text-[12.5px] text-slate-400">No pending alumni status requests.</p>';
        return;
    }
    const section = document.createElement('section');
    section.id = 'alumniRequestSection';
    section.className = 'space-y-3 mb-5';
    section.innerHTML = `<div class="flex items-center justify-between"><div><h2 class="text-base font-bold text-slate-900">Alumni Status Requests <span class="text-[11px] font-semibold text-slate-400" data-alumni-count>(${filtered.length})</span></h2><p class="text-[12px] text-slate-500 mt-0.5">Students who completed their OJT and requested Alumni status.</p></div></div><div class="space-y-3" data-alumni-list>${filtered.length ? filtered.map(alumniRequestCard).join('') : '<p class="text-[12.5px] text-slate-400">No pending alumni status requests.</p>'}</div>`;
    const main = document.querySelector('main');
    if(main) main.insertBefore(section, main.firstElementChild);
}

function processAlumniRequest(email, action){
    const me = currentCoordinator();
    const requests = getAlumniRequests();
    const req = requests.find(r => r.email === email && r.status === 'pending' && (!r.coordinatorEmail || r.coordinatorEmail === me.email));
    if(!req) return;
    if(action === 'approve'){
        const student = getUsers().find(u => u.role === 'student' && u.email === email) || {};
        if(!hasDoc(student.company, student.name, 'Supervisor evaluation')){
            showToast('Upload the signed supervisor evaluation of ' + esc(req.studentName) + ' to their vault folder first.', 'warn');
            return;
        }
        updateUser(email, 'student', {status:'alumni', alumniApprovedAt: todayISO(), completedAt: todayISO(), employment: 'seeking'});
        req.status = 'approved';
        req.approvedAt = new Date().toISOString();
        saveAlumniRequests(requests);
        showToast(req.studentName + ' is now an Alumni.', 'success');
    } else {
        updateUser(email, 'student', {status:'intern', alumniRejectedAt: todayISO()});
        req.status = 'rejected';
        req.rejectedAt = new Date().toISOString();
        saveAlumniRequests(requests);
        showToast(req.studentName + "'s alumni request was rejected.", 'warn');
    }
    renderAlumniRequestSection();
}

document.addEventListener('click', (e) => {
    const approve = e.target.closest('.alumni-approve');
    const reject = e.target.closest('.alumni-reject');
    if(approve || reject){
        const card = (approve || reject).closest('[data-alumni-request-email]');
        if(card) processAlumniRequest(card.dataset.alumniRequestEmail, approve ? 'approve' : 'reject');
    }
});
if(document.getElementById('wr-students') || document.body.dataset.page === 'requests') renderAlumniRequestSection();


/* ============ Student / Alumni Portal (student pages only) ============ */
/* Uses the same localStorage data as the coordinator side: ic_users, ic_classes, ic_session, ic_alumni_requests. */
(function(){
  'use strict';

  const REQUIRED_OJT_HOURS = 486; // eligibility check only; no coordinator hour-setting UI is added here.
  const studentPageMap = {
    overview: 'StudentOverview.html',
    attendance: 'StudentAttendance.html',
    daylog: 'StudentDayLog.html',
    classwork: 'StudentClasswork.html',
    taskdetail: 'StudentTaskDetail.html',
    resume: 'StudentResumeBuilder.html',
    jobs: 'StudentJobMatching.html',
    login: 'InternConnectLogin.html'   // one shared sign in screen for every role
  };

  function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
  }
  function setJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function session(){ return getJSON('ic_session', null); }
  function currentPage(){ return document.body.dataset.page || ''; }
  function show(id){ const el=document.getElementById(id); if(el){ el.classList.remove('hidden'); el.classList.add('flex'); } }
  function hide(id){ const el=document.getElementById(id); if(el){ el.classList.add('hidden'); el.classList.remove('flex'); } }
  function toast(message, type){ if(typeof window.showToast === 'function') window.showToast(message, type || 'info'); }
  function go(page){ if(studentPageMap[page]) window.location.href = studentPageMap[page]; }

  function currentUserRecord(){
    const me = session();
    if(!me || !me.email) return null;
    return getJSON('ic_users', []).find(u => u.role === 'student' && u.email.toLowerCase() === me.email.toLowerCase()) || me;
  }

  function ojtHours(user){
    const value = user && (user.ojtHours ?? user.hours);
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function isAlumni(user){ return !!user && (user.status === 'alumni'); }
  function isPending(user){ return !!user && user.status === 'alumni_pending'; }
  function hasCompletedOJT(user){ return ojtHours(user) >= REQUIRED_OJT_HOURS; }

  function classThemeForUser(user){
    if(!user) return 'sky';
    const classes = getJSON('ic_classes', {});
    const cls = user.classCode ? classes[user.classCode] : null;
    return (cls && cls.theme) || user.theme || 'sky';
  }

  function applyStudentTheme(){
    const user = currentUserRecord();
    if(user && typeof window.applyTheme === 'function'){
      // Theme is inherited from the coordinator's class. No student picker is exposed.
      window.applyTheme(classThemeForUser(user));
    }
  }

  // Fill the name, initials, picture and program from the logged in student
  function personalize(user){
    const me = session() || {};
    const name = (user && user.name) || me.name;
    const program = (user && user.program) || me.program;
    const avatar = (user && user.avatar) || me.avatar;
    const parts = (name || '').trim().split(/\s+/);
    const initials = ((parts[0] || '')[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
    document.querySelectorAll('[data-user="name"]').forEach(el => { if(name) el.textContent = name; });
    document.querySelectorAll('[data-user="program"]').forEach(el => { if(program) el.textContent = program; });
    document.querySelectorAll('[data-user="avatar"]').forEach(el => {
      if(avatar){
        el.innerHTML = '';
        const img = document.createElement('img');
        img.src = avatar; img.alt = ''; img.className = 'w-full h-full object-cover';
        el.appendChild(img);
      } else if(initials){ el.textContent = initials.toUpperCase(); }
    });
  }

  function updateActiveNav(user){
    const page = currentPage();
    document.querySelectorAll('#sidebar .nav-link').forEach(link => link.classList.remove('active'));
    const active = document.querySelector('#sidebar .nav-link[data-tab="' + page + '"]');
    if(active) active.classList.add('active');

    const alumni = isAlumni(user);
    document.querySelectorAll('.student-only-nav').forEach(el => {
      if(alumni) el.classList.add('hidden');
      else el.classList.remove('hidden');
    });

    const jobsLabel = document.getElementById('jobsNavLabel');
    if(jobsLabel) jobsLabel.textContent = alumni ? 'Job Matching' : 'Internship Matching';

    const state = document.getElementById('stateLabel');
    if(state) state.textContent = alumni ? 'Alumni' : (isPending(user) ? 'Student · Alumni Request Pending' : 'Active Student');
  }

  function syncToggle(user){
    const studentBtn = document.getElementById('toggleStudent');
    const alumniBtn = document.getElementById('toggleAlumni');
    const pending = document.getElementById('alumniPendingBadge');
    const wrap = studentBtn && studentBtn.parentElement;

    if(studentBtn) studentBtn.classList.toggle('active', !isAlumni(user));
    if(alumniBtn) alumniBtn.classList.toggle('active', isAlumni(user));

    if(pending){
      pending.classList.toggle('hidden', !isPending(user));
      pending.classList.toggle('flex', isPending(user));
      pending.title = 'Waiting for coordinator approval';
    }

    if(wrap){
      if(isAlumni(user)){
        // Alumni is a final account status; the student toggle cannot switch it back.
        studentBtn?.classList.add('hidden');
        alumniBtn?.classList.remove('hidden');
      } else {
        studentBtn?.classList.remove('hidden');
        alumniBtn?.classList.remove('hidden');
      }
    }
  }

  function findRequest(email){
    return getJSON('ic_alumni_requests', []).find(r => r.email === email && r.status === 'pending') || null;
  }

  function openAlumniModal(){ show('alumniRequestModal'); }
  function closeAlumniModal(){ hide('alumniRequestModal'); }

  function requestAlumniStatus(){
    const user = currentUserRecord();
    if(!user) return toast('Please sign in first.', 'warn');
    if(isAlumni(user)) return;
    if(isPending(user)) return toast('Your Alumni status request is already pending.', 'info');

    // No OJT-hour setting is added here. This only checks whatever hours the coordinator/backend has already saved.
    if(!hasCompletedOJT(user)){
      return toast('You can request Alumni Status after completing your OJT hours.', 'warn');
    }
    openAlumniModal();
  }

  function sendAlumniRequest(){
    const user = currentUserRecord();
    if(!user) return;
    if(!hasCompletedOJT(user)){
      closeAlumniModal();
      return toast('You can request Alumni Status after completing your OJT hours.', 'warn');
    }

    const requests = getJSON('ic_alumni_requests', []);
    if(findRequest(user.email)){
      closeAlumniModal();
      return toast('Your Alumni status request is already pending.', 'info');
    }

    requests.push({
      email: user.email,
      studentName: user.name || 'Student',
      program: user.program || '',
      classCode: user.classCode || '',
      coordinatorEmail: (() => {
        const classes = getJSON('ic_classes', {});
        return user.classCode && classes[user.classCode] ? (classes[user.classCode].coordinator || '') : '';
      })(),
      requestedAt: new Date().toISOString(),
      status: 'pending'
    });
    setJSON('ic_alumni_requests', requests);

    // Keep the canonical user record pending; do not change privileges yet.
    const users = getJSON('ic_users', []);
    const idx = users.findIndex(u => u.role === 'student' && u.email.toLowerCase() === user.email.toLowerCase());
    if(idx >= 0){
      users[idx] = Object.assign({}, users[idx], {status:'alumni_pending', alumniRequestedAt:new Date().toISOString()});
      setJSON('ic_users', users);
    }

    const me = session() || {};
    setJSON('ic_session', Object.assign({}, me, {status:'alumni_pending'}));
    syncToggle(Object.assign({}, user, {status:'alumni_pending'}));
    closeAlumniModal();
    toast('Alumni status request sent to your OJT coordinator.', 'success');
  }

  function refreshStatusFromUser(){
    const rec = currentUserRecord();
    if(!rec) return null;
    const me = session() || {};
    const next = Object.assign({}, me, {
      status: rec.status,
      name: rec.name || me.name,
      program: rec.program || me.program,
      theme: rec.theme || me.theme,
      classCode: rec.classCode || me.classCode,
      hours: ojtHours(rec),
      ojtHours: ojtHours(rec)
    });
    setJSON('ic_session', next);
    return rec;
  }

  function enforceAlumniPageAccess(user){
    const restricted = new Set(['attendance','daylog','classwork','taskdetail']);
    if(isAlumni(user) && restricted.has(currentPage())){
      go('overview');
      return true;
    }
    return false;
  }

  // ---------------- Attendance ----------------
  let attendanceStream = null;
  let attendancePhoto = '';
  let attendancePosition = null;
  let timeInMoment = null;

  function stopAttendanceCamera(){
    if(attendanceStream){
      attendanceStream.getTracks().forEach(t => t.stop());
      attendanceStream = null;
    }
  }

  function startAttendanceCamera(){
    const video = document.getElementById('attendanceCamera');
    const cameraModal = document.getElementById('attendanceCameraModal');
    if(!video || !cameraModal) return;

    show('attendanceCameraModal');
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'user'}, audio:false})
      .then(stream => {
        attendanceStream = stream;
        video.srcObject = stream;
      })
      .catch(() => {
        stopAttendanceCamera();
        hide('attendanceCameraModal');
        toast('Camera access was not granted. Please allow camera access and try again.', 'warn');
      });
  }

  function requestLocation(){
    return new Promise(resolve => {
      if(!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => { attendancePosition = pos.coords; resolve(pos.coords); },
        () => resolve(null),
        {enableHighAccuracy:true, timeout:10000, maximumAge:0}
      );
    });
  }

  async function beginTimeIn(){
    const user = currentUserRecord();
    if(!user || isAlumni(user)) return toast('Time In is only available while you are an active OJT student.', 'warn');
    const pl = placementList().find(x => x.name === user.name);
    if(!pl || !['Deployed', 'Hours complete'].includes(pl.status)) return toast('Time In opens after your coordinator confirms your deployment.', 'warn');
    if((liveRecs(user.name)[todayISO()] || {}).in != null) return toast('You already timed in today.', 'info');

    show('attendancePermissionModal');
  }

  async function allowAttendance(){
    hide('attendancePermissionModal');
    const locPromise = requestLocation();
    startAttendanceCamera();
    await locPromise;
    if(!attendancePosition) toast('Location permission was not available. The attendance can continue only if the location can be verified.', 'warn');
  }

  function captureAttendancePhoto(){
    const video = document.getElementById('attendanceCamera');
    const canvas = document.getElementById('attendanceCanvas');
    const previewWrap = document.getElementById('timeInPhotoPreview');
    const img = document.getElementById('timeInPhoto');
    if(!video || !canvas || !video.videoWidth) return toast('Camera is not ready yet. Please wait a moment.', 'warn');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    attendancePhoto = canvas.toDataURL('image/jpeg', 0.82);
    if(img){ img.src = attendancePhoto; }
    if(previewWrap){ previewWrap.classList.remove('hidden'); previewWrap.classList.add('flex'); }
    document.getElementById('captureAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('captureAttendancePhotoBtn')?.classList.remove('flex');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.add('flex');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.add('flex');
  }

  function retakeAttendancePhoto(){
    attendancePhoto = '';
    document.getElementById('captureAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('captureAttendancePhotoBtn')?.classList.add('flex');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.remove('flex');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.remove('flex');
  }

  function confirmTimeIn(){
    if(!attendancePhoto) return toast('Capture an attendance photo first.', 'warn');
    if(!attendancePosition) return toast('Your location could not be verified. Allow location access and try again.', 'warn');
    timeInMoment = new Date();
    saveLiveClock(getJSON('ic_session', {}).name, 'in', attendancePhoto, attendancePosition);
    stopAttendanceCamera();
    hide('attendanceCameraModal');
    hide('timeInPrompt');
    const confirmation = document.getElementById('timeInConfirmation');
    if(confirmation){ confirmation.classList.remove('hidden'); confirmation.classList.add('flex'); }
    const stamp = document.getElementById('timeInStamp');
    if(stamp) stamp.textContent = timeInMoment.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    const stored = getJSON('ic_attendance', []);
    stored.unshift({date:new Date().toISOString(), timeIn:timeInMoment.toISOString(), photo:attendancePhoto, gps: attendancePosition ? {lat:attendancePosition.latitude, lng:attendancePosition.longitude} : null});
    setJSON('ic_attendance', stored.slice(0,100));
    toast('Time In recorded with your attendance photo and location.', 'success');
  }

  function timeOut(){
    const me = getJSON('ic_session', {}), today = liveRecs(me.name)[todayISO()] || {};
    if(today.in == null) return toast('Please Time In first.', 'warn');
    if(today.out != null) return toast('You already timed out today.', 'info');
    const timeOutMoment = new Date();
    hide('timeInConfirmation');
    const out = document.getElementById('timeOutConfirmation');
    if(out){ out.classList.remove('hidden'); out.classList.add('flex'); }
    const stamp = document.getElementById('timeOutStamp');
    if(stamp) stamp.textContent = timeOutMoment.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const hrs = saveLiveClock(me.name, 'out', '', attendancePosition);
    const total = document.getElementById('hoursTotal');
    if(total) total.textContent = hrs;
    toast('Time Out recorded — hours logged for today.', 'success');
  }

  // Sample attendance for September 2026. The same data feeds the calendar, the summary table and the day details page.
  const attendanceRecords = (function(){
    const present = {1:['8:01 AM','5:03 PM',8.0], 2:['8:04 AM','5:01 PM',7.9], 3:['7:58 AM','5:06 PM',8.1], 4:['8:03 AM','5:00 PM',7.9],
      7:['8:00 AM','5:02 PM',8.0], 8:['8:06 AM','5:04 PM',7.9], 9:['8:02 AM','5:08 PM',8.1], 10:['8:01 AM','5:00 PM',8.0], 11:['8:05 AM','5:02 PM',7.9],
      14:['8:03 AM','5:05 PM',8.0], 15:['8:02 AM','5:10 PM',8.1]};
    const list = Object.keys(present).map(d => ({day: Number(d), in: present[d][0], out: present[d][1], hours: present[d][2], status: 'present'}));
    list.push({day: 16, in: '', out: '', hours: 0, status: 'absent'});
    return list.sort((a, b) => a.day - b.day).map(r => Object.assign({date: '2026-09-' + String(r.day).padStart(2, '0')}, r));
  })();
  const shortDate = (day) => 'Sept ' + day + ', 2026';
  const longDate = (day) => 'September ' + day + ', 2026';
  const openDay = (date) => { window.location.href = studentPageMap.daylog + '?date=' + date; };

  function initCalendar(){
    const calendar = document.getElementById('attendanceCalendar');
    if(!calendar) return;
    calendar.innerHTML = '';
    const byDay = {};
    attendanceRecords.forEach(r => byDay[r.day] = r);
    const firstWeekday = new Date(2026, 8, 1).getDay();   // Sept 1, 2026 is a Tuesday
    for(let i = 0; i < firstWeekday; i++) calendar.insertAdjacentHTML('beforeend', '<div class="cal-day empty"></div>');
    for(let d = 1; d <= 30; d++){
      const rec = byDay[d];
      const weekday = new Date(2026, 8, d).getDay();
      const cell = document.createElement('div');
      cell.className = 'cal-day' + (rec ? ' ' + rec.status : '') + (!rec && (weekday === 0 || weekday === 6) ? ' weekend' : '');
      cell.innerHTML = d + (rec ? '<span class="cal-dot"></span>' : '');
      if(rec){
        cell.title = rec.status === 'present' ? rec.in + ' – ' + rec.out : 'Absent';
        cell.addEventListener('click', () => openDay(rec.date));
      }
      calendar.appendChild(cell);
    }
  }

  function initAttendanceSummary(){
    const body = document.getElementById('attendanceSummaryBody');
    if(!body) return;
    const present = attendanceRecords.filter(r => r.status === 'present');
    const absent = attendanceRecords.filter(r => r.status === 'absent');
    const total = present.reduce((sum, r) => sum + r.hours, 0);
    const stats = document.getElementById('attendanceStats');
    if(stats) stats.innerHTML =
        '<span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">' + present.length + ' present</span>'
      + '<span class="px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold">' + absent.length + ' absent</span>'
      + '<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">' + total.toFixed(1) + ' hrs logged</span>';
    body.innerHTML = attendanceRecords.slice().reverse().map(r => {
      const ok = r.status === 'present';
      return '<tr class="cursor-pointer hover:bg-slate-50" data-date="' + r.date + '">'
        + '<td class="px-5 py-3 text-slate-700 whitespace-nowrap">' + shortDate(r.day) + '</td>'
        + '<td class="px-5 py-3"><div class="w-9 h-9 rounded-md flex items-center justify-center ' + (ok ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-300') + '"><i class="fa-solid fa-image text-xs"></i></div></td>'
        + '<td class="px-5 py-3 whitespace-nowrap ' + (ok ? 'text-slate-600' : 'text-red-500') + '">' + (ok ? r.in : '— Absent') + '</td>'
        + '<td class="px-5 py-3 whitespace-nowrap ' + (ok ? 'text-slate-600' : 'text-red-500') + '">' + (ok ? r.out : '—') + '</td>'
        + '<td class="px-5 py-3 text-slate-400 text-[11.5px] whitespace-nowrap">' + (ok ? '14.3080°N, 120.9540°E' : '—') + '</td>'
        + '<td class="px-5 py-3 font-medium whitespace-nowrap ' + (ok ? 'text-slate-700' : 'text-slate-400') + '">' + (ok ? r.hours.toFixed(1) : 0) + ' hrs</td>'
        + '<td class="px-5 py-3">' + (ok
            ? '<span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Verified</span>'
            : '<span class="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Absent</span>') + '</td>'
        + '</tr>';
    }).join('');
    body.querySelectorAll('tr').forEach(row => row.addEventListener('click', () => openDay(row.dataset.date)));
  }

  // Day details page (?date=2026-09-15)
  function initDayLog(){
    const title = document.getElementById('dayLogDate');
    if(!title) return;
    const date = new URLSearchParams(window.location.search).get('date');
    const rec = attendanceRecords.find(r => r.date === date) || attendanceRecords.find(r => r.day === 15);
    const ok = rec.status === 'present';
    title.textContent = longDate(rec.day);
    const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
    set('dlIn', ok ? rec.in : '—');
    set('dlOut', ok ? rec.out : '—');
    set('dlHours', (ok ? rec.hours.toFixed(1) : 0) + ' hrs');
    const status = document.getElementById('dlStatus');
    if(status){
      status.textContent = ok ? 'Verified' : 'Absent';
      status.className = (ok ? 'text-emerald-600' : 'text-red-500') + ' font-medium';
    }
  }

  // ---------------- Resume Builder ----------------
  function linesToListItems(text){
    return (text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => '<li>' + l.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</li>').join('');
  }
  function linesToParagraphLines(text){
    return (text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('<br>');
  }

  function renderResumePreview(){
    const get = id => document.getElementById(id);
    if(!get('pv-name')) return;
    get('pv-name').textContent = get('ed-name')?.value || 'Your Name';
    get('pv-contact').textContent = (get('ed-phone')?.value || '') + ' · ' + (get('ed-email')?.value || '');
    get('pv-objective').textContent = get('ed-objective')?.value || '';
    get('pv-education').textContent = get('ed-education')?.value || '';

    const work = get('ed-workexp')?.value.trim() || '';
    get('pv-workexp-wrap').style.display = work ? '' : 'none';
    get('pv-workexp').innerHTML = linesToParagraphLines(work);

    const soft = [...document.querySelectorAll('#softTagBox .tag-chip')].map(c => c.childNodes[0]?.textContent?.trim() || '').filter(Boolean);
    const hard = [...document.querySelectorAll('#techTagBox .tag-chip')].map(c => c.childNodes[0]?.textContent?.trim() || '').filter(Boolean);
    get('pv-softskills').innerHTML = soft.map(x => '<span class="tag-chip soft">' + x + '</span>').join('');
    get('pv-hardskills').innerHTML = hard.map(x => '<span class="tag-chip">' + x + '</span>').join('');

    const includeThesis = get('includeThesisToggle')?.checked;
    const thesisTitle = get('ed-thesisTitle')?.value.trim() || '';
    get('pv-projects-wrap').style.display = includeThesis && thesisTitle ? '' : 'none';
    get('pv-projects').textContent = thesisTitle + ((get('ed-thesisRole')?.value || '').trim() ? ' — ' + get('ed-thesisRole').value.trim() : '');

    const includeCerts = get('includeCertsToggle')?.checked;
    const certItems = [...document.querySelectorAll('#certRows > div')].map(row=>{
      const inputs=row.querySelectorAll('input');
      return inputs[0]?.value ? inputs[0].value + (inputs[1]?.value ? ' — ' + inputs[1].value : '') : '';
    }).filter(Boolean);
    get('pv-certs-wrap').style.display = includeCerts && certItems.length ? '' : 'none';
    get('pv-certs').innerHTML = certItems.map(x => '<li>'+x+'</li>').join('');

    const vol=get('ed-volunteer')?.value.trim()||'';
    get('pv-volunteer-wrap').style.display=vol?'':'none';
    get('pv-volunteer').innerHTML=linesToListItems(vol);
    const awards=get('ed-awards')?.value.trim()||'';
    get('pv-awards-wrap').style.display=awards?'':'none';
    get('pv-awards').innerHTML=linesToListItems(awards);

    const pvCustom=get('pv-customsections'); if(pvCustom){
      pvCustom.innerHTML='';
      document.querySelectorAll('.custom-section-edit').forEach(sec=>{
        const title=sec.querySelector('.custom-title')?.value.trim()||'';
        const txt=sec.querySelector('.custom-text')?.value.trim()||'';
        if(!title&&!txt)return;
        const block=document.createElement('div'); block.className='py-3 border-b border-slate-100';
        block.innerHTML='<h3 class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">'+(title||'Additional Section')+'</h3><ul class="text-[13px] text-slate-600 space-y-1 list-disc list-inside">'+linesToListItems(txt)+'</ul>';
        pvCustom.appendChild(block);
      });
    }
  }

  function wireTagInput(inputId, chipClass){
    const input=document.getElementById(inputId); if(!input) return;
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter' && input.value.trim()){
        e.preventDefault();
        const max = inputId === 'softTagInput' ? 4 : 15;
        const existing = [...input.parentElement.querySelectorAll('.tag-chip')].map(c => (c.childNodes[0]?.textContent || '').trim().toLowerCase());
        if(existing.length >= max){ input.value=''; return toast('Maximum of ' + max + ' tags reached.','warn'); }
        if(existing.includes(input.value.trim().toLowerCase())){ input.value=''; return toast('That skill is already added.','info'); }
        const chip=document.createElement('span'); chip.className='tag-chip '+(chipClass||'');
        chip.innerHTML = input.value.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;') + ' <button type="button"><i class="fa-solid fa-xmark"></i></button>';
        chip.querySelector('button').addEventListener('click',()=>chip.remove());
        input.parentElement.insertBefore(chip,input); input.value='';
      }
    });
  }

  function initResume(){
    document.querySelectorAll('.resume-subtab-btn').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.resume-subtab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.resume-subtab-panel').forEach(p=>p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.resumetab)?.classList.remove('hidden');
      if(btn.dataset.resumetab==='resume-preview') renderResumePreview();
    }));
    wireTagInput('techTagInput','');
    wireTagInput('softTagInput','soft');
    document.querySelectorAll('.example-chip').forEach(btn => btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.exampleFor);
      if(!input) return;
      input.value = btn.textContent.trim();
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    }));
    document.getElementById('saveSkillsBtn')?.addEventListener('click',()=>{renderResumePreview(); document.getElementById('saveSkillsMicrocopy')?.classList.remove('hidden'); toast('Saved — your resume preview has been updated.','success');});
    document.getElementById('uploadResumePdfBtn')?.addEventListener('click',()=>{const row=document.getElementById('uploadedPdfRow'); if(row){row.classList.remove('hidden'); row.classList.add('flex');} toast('Resume PDF attached.','success');});
    document.getElementById('addCertBtn')?.addEventListener('click',()=>{
      const rows=document.getElementById('certRows'); if(!rows) return;
      if(rows.children.length>=5) return toast('Maximum of 5 certification entries reached.','warn');
      const row=document.createElement('div'); row.className='grid sm:grid-cols-[1fr_1fr_100px] gap-2';
      row.innerHTML='<input type="text" maxlength="60" placeholder="Certification Name" class="border border-slate-300 rounded-md px-3 py-2 text-[12.5px]"><input type="text" maxlength="60" placeholder="Issuing Organization" class="border border-slate-300 rounded-md px-3 py-2 text-[12.5px]"><select class="border border-slate-300 rounded-md px-2 py-2 text-[12.5px]"><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select>';
      rows.appendChild(row);
    });
    document.getElementById('addCustomSectionBtn')?.addEventListener('click',()=>{
      const wrap=document.getElementById('customSections'); if(!wrap)return;
      const card=document.createElement('div'); card.className='border border-slate-200 rounded-lg p-4 custom-section-edit';
      card.innerHTML='<div class="flex items-center justify-between mb-2.5"><input type="text" placeholder="Section title (e.g., Seminars Attended)" class="custom-title flex-1 border-b border-slate-300 focus:outline-none text-[13px] font-semibold text-slate-700 py-1 mr-3"><span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Self-Declared</span></div><textarea rows="2" placeholder="What would you like to add here? One item per line." class="custom-text w-full border border-slate-300 rounded-md px-3 py-2 text-[13px]"></textarea><button type="button" class="remove-section-btn text-[11px] text-red-500 mt-2"><i class="fa-solid fa-trash mr-1"></i>Remove section</button>';
      card.querySelector('.remove-section-btn').addEventListener('click',()=>{card.remove();renderResumePreview();});
      wrap.appendChild(card);
    });
    document.getElementById('includeThesisToggle')?.addEventListener('change',function(){document.getElementById('thesisFields')?.classList.toggle('hidden',!this.checked);});
    document.getElementById('includeCertsToggle')?.addEventListener('change',function(){document.getElementById('certRows')?.classList.toggle('hidden',!this.checked); document.getElementById('addCertBtn')?.classList.toggle('hidden',!this.checked);});
    renderResumePreview();
  }

  // ---------------- Classwork / Task Detail ----------------
  function initClasswork(){
    document.querySelectorAll('.task-card').forEach(card=>card.addEventListener('click',()=>{
      window.location.href = studentPageMap.taskdetail + '?task=' + encodeURIComponent(card.dataset.task || 'week5');
    }));
  }

  function renderHighlight(){
    const ta=document.getElementById('reportTextarea'), out=document.getElementById('highlightPreview'); if(!ta||!out)return;
    const keywords=['tinulungan','tinest','nag-ayos','nag-attend','ginawa','natapos','nag-develop','na-fix','fixed','developed','assisted','tested','refactored','reviewed','nag-refactor','na-review','naayos','nag-log','nag-retest'];
    const raw=ta.value||'';
    out.innerHTML=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').split('\n').map(line=>{
      const yes=keywords.some(k=>line.toLowerCase().includes(k));
      return yes && line.trim() ? '<span class="highlight-mark">'+line+'</span>' : line;
    }).join('\n');
  }
  function initTaskDetail(){
    const taskData={
      week5:{title:'Week 5 Accomplishment Report',instructions:'Summarize your work for Sept 15–19. Include hours rendered and key tasks completed.',due:'Due Sept 19, 11:59 PM'},
      week4:{title:'Week 4 Accomplishment Report',instructions:'Summarize your work for Sept 8–12.',due:'Due Sept 12, 11:59 PM · Verified'}
    };
    const params=new URLSearchParams(location.search); const t=taskData[params.get('task')]||taskData.week5;
    if(document.getElementById('taskDetailTitle')){
      document.getElementById('taskDetailTitle').textContent=t.title;
      document.getElementById('taskDetailInstructions').textContent=t.instructions;
      document.getElementById('taskDetailDue').innerHTML='<i class="fa-regular fa-calendar mr-1"></i>'+t.due;
    }
    const ta=document.getElementById('reportTextarea');
    ta?.addEventListener('input',renderHighlight);
    ta?.addEventListener('keydown',function(e){ if(e.key==='Tab'){e.preventDefault(); const s=this.selectionStart,en=this.selectionEnd;this.value=this.value.substring(0,s)+'\t'+this.value.substring(en);this.selectionStart=this.selectionEnd=s+1;renderHighlight();}});
    document.getElementById('backToClassworkBtn')?.addEventListener('click',()=>go('classwork'));
    document.getElementById('genPdfBtn')?.addEventListener('click',()=>toast('Generating PDF of your report...','info'));
    document.getElementById('genWordBtn')?.addEventListener('click',()=>toast('Generating Word document of your report...','info'));
    renderHighlight();
  }

  // ---------------- Jobs ----------------
  const jobDetails={
    'qa-brightpath':{title:'Junior QA & Documentation Intern',company:'Brightpath Software',score:'94% match',type:'Internship · Hybrid',location:'Dasmariñas, Cavite · 2.5 km away',salary:'₱3,500 / month OJT allowance',description:'Assist the QA team in testing software releases and maintaining internal documentation for ongoing projects.',requirements:['Currently enrolled in BS Computer Science or related program','Basic understanding of SQL and relational databases','Willing to work in a hybrid setup (2 days onsite per week)','Good written communication skills for documentation'],skills:[['SQL',true],['Documentation',true],['Agile',false]],deadline:'Application deadline: Oct 10, 2026'},
    'fe-verano':{title:'Front-End Developer',company:'Verano Digital Studio',score:'81% match',type:'Full-time · Remote',location:'Remote · 5.8 km from campus',salary:'₱18,000 – ₱22,000 / month',description:'Build and maintain client-facing web interfaces, working closely with designers to implement responsive layouts.',requirements:['Graduate of BS Computer Science or related program','Proficient in HTML, CSS, and JavaScript','Familiarity with design tools (Figma or similar) is a plus','Can work independently in a remote setup'],skills:[['Canva',true],['Figma',false],['HTML/CSS',true]],deadline:'Application deadline: Oct 15, 2026'},
    'fd-cavitegrand':{title:'Front Desk & Guest Relations Associate',company:'Cavite Grand Hotel',score:'73% match',type:'Part-time · Onsite',location:'Dasmariñas, Cavite · 3.1 km away',salary:'₱430 / day + meal allowance',description:'Handle guest check-in/check-out, respond to guest concerns, and support front office operations during shift hours.',requirements:['Currently enrolled in BS Hospitality Management','Pleasing personality and strong communication skills','Willing to work on a part-time shifting schedule, including weekends','Basic computer literacy (MS Office, booking systems)'],skills:[['Customer Service',true],['Events Coordination',false]],deadline:'Application deadline: Oct 5, 2026'}
  };

  function filterJobs(){
    const list=document.getElementById('jobList'); if(!list)return;
    const user=currentUserRecord(); const alumni=isAlumni(user);
    const course=document.getElementById('courseFilter')?.value||'';
    const type=document.getElementById('typeFilter')?.value||'';
    const arrangement=document.getElementById('arrangementFilter')?.value||'';
    let visible=0;
    list.querySelectorAll('.job-card').forEach(card=>{
      const courseOk=!course||card.dataset.course===course;
      const typeOk=alumni ? (card.dataset.type!=='Internship' && (!type || card.dataset.type===type)) : card.dataset.type==='Internship';
      const arrangeOk=!arrangement||card.dataset.arrangement===arrangement;
      const ok=courseOk&&typeOk&&arrangeOk;
      card.classList.toggle('hidden',!ok); if(ok)visible++;
    });
    document.getElementById('fallbackAlert')?.classList.toggle('hidden',visible!==0);
    document.getElementById('typeFilter')?.classList.toggle('hidden',!alumni);
  }

  function openJobModal(id){
    const j=jobDetails[id]; if(!j)return;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('jobModalTitle',j.title);set('jobModalCompany',j.company);set('jobModalType',j.type);set('jobModalSalary',j.salary);set('jobModalDescription',j.description);set('jobModalDeadline',j.deadline);
    const score=document.getElementById('jobModalScore');if(score)score.innerHTML='<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>'+j.score;
    const loc=document.getElementById('jobModalLocation');if(loc)loc.innerHTML='<i class="fa-solid fa-location-dot mr-1"></i>'+j.location;
    const req=document.getElementById('jobModalRequirements');if(req)req.innerHTML=j.requirements.map(x=>'<li>'+x+'</li>').join('');
    const tags=document.getElementById('jobModalSkillTags');if(tags)tags.innerHTML=j.skills.map(([n,m])=>(m ? '<span class="tag-chip matched"><i class="fa-solid fa-check"></i>'+n+'</span>' : '<span class="tag-chip gap">'+n+' <span class="chip-note">gap</span></span>')).join('');
    document.getElementById('jobModalApplyBtn')?.setAttribute('data-job',id);
    show('jobModal');
  }
  function initJobs(){
    document.getElementById('courseFilter')?.addEventListener('change',filterJobs);
    document.getElementById('typeFilter')?.addEventListener('change',filterJobs);
    document.getElementById('arrangementFilter')?.addEventListener('change',filterJobs);
    document.querySelectorAll('.job-card').forEach(card=>card.addEventListener('click',e=>{if(e.target.closest('.apply-btn'))return;openJobModal(card.dataset.job);}));
    document.querySelectorAll('.apply-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const id=btn.closest('.job-card')?.dataset.job;const j=jobDetails[id];toast('Application submitted to '+(j?.company||'the employer')+'.','success');}));
    document.getElementById('closeJobModalBtn')?.addEventListener('click',()=>hide('jobModal'));
    document.getElementById('jobModalApplyBtn')?.addEventListener('click',()=>{const id=document.getElementById('jobModalApplyBtn').dataset.job; const j=jobDetails[id]; toast('Application submitted to '+(j?.company||'the employer')+'.','success');hide('jobModal');});
    filterJobs();
  }

  // ---------------- Common Page Init ----------------
  function initCommon(){
    if(document.body.dataset.role !== 'student' || !document.getElementById('sidebar')) return;   // student dashboard pages only
    const user=refreshStatusFromUser();
    if(!user && currentPage()!=='login') return;
    if(user){
      // A student the coordinator has not approved yet cannot enter the portal
      if(user.status === 'pending'){
        localStorage.removeItem('ic_session');
        sessionStorage.setItem('pendingToast', JSON.stringify({message:'Your request to join the class is still waiting for coordinator approval.', type:'warn'}));
        go('login');
        return;
      }
      applyStudentTheme();
      personalize(user);
      if(enforceAlumniPageAccess(user)) return;
      updateActiveNav(user);
      syncToggle(user);
    }

    document.getElementById('toggleStudent')?.addEventListener('click',()=>{
      const u=currentUserRecord(); if(!u)return;
      if(isAlumni(u)) return toast('Your account is already in Alumni Status.','info');
      if(isPending(u)) return toast('Your Alumni status request is still pending.','info');
      toast('You are currently in Student mode.','info');
    });
    document.getElementById('toggleAlumni')?.addEventListener('click',requestAlumniStatus);
    document.getElementById('alumniPendingBadge')?.addEventListener('click',()=>toast('Your Alumni status request is waiting for coordinator approval.','info'));
    document.getElementById('cancelAlumniRequestBtn')?.addEventListener('click',closeAlumniModal);
    document.getElementById('sendAlumniRequestBtn')?.addEventListener('click',sendAlumniRequest);
    document.getElementById('logoutBtn')?.addEventListener('click',()=>{localStorage.removeItem('ic_session');sessionStorage.setItem('pendingToast',JSON.stringify({message:'You have been logged out.',type:'info'}));window.location.href=studentPageMap.login;});

    // Common mobile sidebar
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),mobile=document.getElementById('mobileToggle'),close=document.getElementById('mobileCloseBtn');
    const open=()=>{sidebar?.classList.remove('-translate-x-full');overlay?.classList.remove('hidden');mobile?.classList.add('hidden');};
    const shut=()=>{sidebar?.classList.add('-translate-x-full');overlay?.classList.add('hidden');mobile?.classList.remove('hidden');};
    mobile?.addEventListener('click',open);close?.addEventListener('click',shut);overlay?.addEventListener('click',shut);

    document.getElementById('notifBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('notifDropdown')?.classList.toggle('hidden');});
    document.addEventListener('click',e=>{const d=document.getElementById('notifDropdown');if(d && !d.contains(e.target) && e.target.id!=='notifBtn')d.classList.add('hidden');});

    if(currentPage()==='attendance') initCalendar(); initAttendanceSummary(); initDayLog();
    if(currentPage()==='resume') initResume();
    if(currentPage()==='classwork') initClasswork();
    if(currentPage()==='taskdetail') initTaskDetail();
    if(currentPage()==='jobs') initJobs();

    // Attendance controls exist only on the attendance page.
    document.getElementById('timeInBtn')?.addEventListener('click',beginTimeIn);
    document.getElementById('cancelAttendancePermissionBtn')?.addEventListener('click',()=>hide('attendancePermissionModal'));
    document.getElementById('allowAttendancePermissionBtn')?.addEventListener('click',allowAttendance);
    document.getElementById('cancelAttendanceCameraBtn')?.addEventListener('click',()=>{stopAttendanceCamera();hide('attendanceCameraModal');});
    document.getElementById('captureAttendancePhotoBtn')?.addEventListener('click',captureAttendancePhoto);
    document.getElementById('retakeAttendancePhotoBtn')?.addEventListener('click',retakeAttendancePhoto);
    document.getElementById('confirmAttendancePhotoBtn')?.addEventListener('click',confirmTimeIn);
    document.getElementById('timeOutBtn')?.addEventListener('click',timeOut);
    document.getElementById('backToAttendanceBtn')?.addEventListener('click',()=>go('attendance'));
  }

  document.addEventListener('DOMContentLoaded',()=>{ initCommon(); });
  window.addEventListener('beforeunload',stopAttendanceCamera);
})();


/* ============ Student side: placement, classwork, files, attendance (uses the coordinator data) ============ */
if(document.body.dataset.role === 'student') document.addEventListener('DOMContentLoaded', () => {
    const me = getJSON('ic_session', {}) || {};
    if(!me.name) return;
    const mine = () => placementList().find(p => p.name === me.name || (me.email && p.email === me.email)) || {name: me.name, status: 'Not placed', history: [], company: ''};
    const card = (title, body, right) => '<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5"><div class="flex items-center justify-between gap-2 mb-3"><h2 class="font-semibold text-slate-900 text-sm">' + title + '</h2>' + (right || '') + '</div>' + body + '</div>';
    const field = 'border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    const NEXT = {
        'Not placed': 'Record where you applied so your coordinator can endorse you.',
        'Applied': 'Your coordinator will review your application and prepare your endorsement letter.',
        'Endorsed': 'Bring your signed endorsement letter to the company. Waiting for their acceptance letter.',
        'Accepted': 'Accepted! Waiting for your coordinator to confirm your start date and schedule.',
        'Deployed': 'You can clock in and out on the Attendance page.',
        'Hours complete': 'Hours complete. Waiting for your supervisor evaluation.',
        'Completed': 'OJT completed. Your records are kept for 5 years after completion.',
        'Withdrawn': 'Your OJT was withdrawn. Talk to your coordinator.'
    };

    // ---- Overview: my internship, my files, data deletion (alumni) ----
    const ov = document.getElementById('tab-overview');
    function renderStudentOverview(){
        const p = mine();
        document.getElementById('myInternship')?.remove();
        const steps = PLACEMENT_STEPS.slice(1);
        const at = steps.indexOf(p.status);
        const progress = '<div class="flex flex-wrap gap-1.5 mb-3">' + steps.map((st, i) => '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border '
            + (i < at || p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i === at ? 'bg-sky-600 text-white border-sky-600' : 'text-slate-400 border-slate-200') + '">' + st + '</span>').join('') + '</div>';
        let body = progress + '<p class="text-[12.5px] text-slate-600">' + (p.company ? '<strong>' + esc(p.company) + '</strong>' + (p.position ? ' · ' + esc(p.position) : '') + ' · ' : '') + NEXT[p.status] + '</p>';
        if(p.status === 'Not placed') body += '<div class="grid sm:grid-cols-[1fr_1fr_150px_auto] gap-2 mt-3">'
            + '<select id="stApplyCompany" class="' + field + '">' + PARTNER_COMPANIES.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>'
            + '<input id="stApplyPosition" placeholder="Position (e.g. Web Developer Intern)" class="' + field + '"><input id="stApplyDate" type="date" value="' + todayISO() + '" class="' + field + '">'
            + '<button id="stApplyBtn" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-md">Record application</button></div>'
            + '<p class="text-[11px] text-slate-400 mt-1.5">One active application at a time. Your coordinator can also record it for you.</p>';
        if(p.status === 'Applied' && p.source === 'student') body += '<button id="stCancelApply" class="mt-3 text-[12px] font-semibold text-red-600 hover:text-red-700">Cancel application</button>';
        if(['Deployed', 'Hours complete'].includes(p.status)){
            const sc = scheduleOf(p);
            body += '<div class="mt-3 grid sm:grid-cols-2 gap-2 text-[12.5px]"><div class="rounded-lg border border-slate-200 px-3 py-2"><div class="text-[10.5px] text-slate-500">Hours rendered</div><div class="font-bold text-slate-900">' + (p.hours || 0) + ' / ' + REQUIRED_HOURS + '</div></div>'
                + '<div class="rounded-lg border border-slate-200 px-3 py-2"><div class="text-[10.5px] text-slate-500">Schedule (' + sc.mode + ')</div><div class="font-semibold text-slate-800">' + scheduleText(sc) + '</div><div class="text-[10.5px] text-slate-400">Late after ' + fmtClock(clockMins(sc.timeIn) + sc.grace) + '</div></div></div>';
        }
        const docs = internDocs(p.company, p.name);
        const files = !p.company ? '<p class="text-[12.5px] text-slate-400">Your folder is created once you apply to a partner company.</p>'
            : docs.length ? '<div class="divide-y divide-slate-100">' + docs.map(f => '<div class="flex items-center justify-between gap-3 py-2"><div class="flex items-center gap-2.5"><i class="fa-solid fa-file-pdf text-red-400"></i><div><div class="text-[12.5px] text-slate-800">' + esc(f.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(f.type) + ' · ' + formatDate(f.uploadedAt) + (f.version > 1 ? ' · v' + f.version : '') + '</div></div></div><span class="text-[10.5px] text-slate-400">view only</span></div>').join('') + '</div>'
            : '<p class="text-[12.5px] text-slate-400">No signed scans yet.</p>';
        let deletion = '';
        if(p.status === 'Completed'){
            const r = getDeletionRequests().find(x => x.name === p.name);
            const keep = retainUntil(alumniCompletedAt(p));
            deletion = card('My data', !r ? '<p class="text-[12.5px] text-slate-600 mb-3">You can ask to delete your profile, resume and job-matching data. Your OJT record (hours, attendance, approved logs, signed scans) is kept read-only until <strong>' + keep + '</strong>.</p><button id="stDeleteReq" class="text-[12.5px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-md">Request data deletion</button>'
                : r.status === 'pending' ? '<p class="text-[12.5px] text-slate-600">Deletion requested on ' + formatDate(r.requestedAt) + '. Waiting for your coordinator.</p>'
                : r.status === 'held' ? '<div class="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"><strong>On hold (' + formatDate(r.heldAt) + '):</strong> ' + esc(r.holdReason) + '</div>'
                : '<p class="text-[12.5px] text-slate-600">Your profile data was deleted on ' + formatDate(r.processedAt) + '. Your OJT record is kept until ' + keep + '.</p>');
        }
        ov.children[0].insertAdjacentHTML('afterend', '<div id="myInternship" class="grid lg:grid-cols-[1fr_380px] gap-4 items-start">' + card('My Internship', body, placementBadge(p.status)) + '<div class="space-y-4">' + card('My files', files, p.company ? '<span class="text-[10.5px] text-slate-400">' + esc(p.company) + ' vault</span>' : '') + deletion + '</div></div>');
        const stats = ov.querySelectorAll('.grid.grid-cols-2 > div');
        if(stats[0]){ const pct = Math.min(100, Math.round((p.hours || 0) / REQUIRED_HOURS * 100)); stats[0].querySelector('.text-lg').innerHTML = (p.hours || 0) + ' <span class="text-[12px] font-medium text-slate-400">/ ' + REQUIRED_HOURS + ' hrs</span>'; stats[0].querySelector('.bg-sky-600').style.width = pct + '%'; }
        if(stats[1]) stats[1].querySelector('.text-2xl').textContent = myTasks().filter(t => t.status === 'open' && !['Pending Review', 'Verified'].includes(mySub(t.id).status)).length;
        renderNotifs();
    }
    if(ov){
        renderStudentOverview();
        ov.addEventListener('click', (e) => {
            const p = mine();
            if(e.target.closest('#stApplyBtn')){
                const company = document.getElementById('stApplyCompany').value, position = document.getElementById('stApplyPosition').value.trim(), date = document.getElementById('stApplyDate').value || todayISO();
                savePlacement(p.name, {status: 'Applied', company, position, source: 'student', email: me.email, history: (p.history || []).concat({status: 'Applied', date, note: company + (position ? ' · ' + position : '') + ' · by student'})});
                showToast('Application to ' + esc(company) + ' recorded. Your coordinator will review it.', 'success');
            }
            if(e.target.closest('#stCancelApply')){
                if(!confirm('Cancel your application to ' + p.company + '?')) return;
                savePlacement(p.name, {status: 'Not placed', company: '', position: '', source: '', history: (p.history || []).concat({status: 'Not placed', date: todayISO(), note: 'Application cancelled by student'})});
                showToast('Application cancelled.', 'warn');
            }
            if(e.target.closest('#stDeleteReq')){
                if(!confirm('Request deletion of your profile, resume and job-matching data?')) return;
                const all = getDeletionRequests().concat({name: p.name, requestedAt: todayISO(), status: 'pending', completedAt: alumniCompletedAt(p)});
                localStorage.setItem(DELETION_KEY, JSON.stringify(all));
                showToast('Deletion request sent to your coordinator.', 'success');
            }
            if(e.target.closest('#stApplyBtn, #stCancelApply, #stDeleteReq')) renderStudentOverview();
        });
    }

    // ---- Classwork and task detail: tasks posted by the coordinator ----
    function myTasks(){ return getAllTasks().filter(t => t.classCode === (me.classCode || SEED_CODE) && t.status !== 'archived'); }
    const due = (t) => 'Due ' + formatDate(t.dueDate) + (t.dueTime ? ', ' + fmtClock(clockMins(t.dueTime)) : '');
    const files = (t) => (t.template ? '<span class="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-file-lines"></i>Template: ' + esc(t.template) + '</span>' : '')
        + (t.attachments || []).map(a => '<span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-paperclip"></i>' + esc(a) + '</span>').join('');
    function mySub(id){ return taskInfo(id).submissions.find(x => x.name === me.name) || {}; }
    const subBadge = (t) => {
        const st = mySub(t.id).status;
        const [txt, cls] = st ? [st, SUB_CLASS[st]] : t.status === 'closed' ? ['Closed', 'text-slate-500 bg-slate-100 border-slate-200'] : ['Not submitted', 'text-amber-600 bg-amber-50 border-amber-200'];
        return '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ' + cls + '">' + txt + '</span>';
    };
    const list = document.getElementById('loggingForm');
    if(list && document.getElementById('tab-classwork')){
        const tasks = myTasks();
        list.innerHTML = tasks.length ? tasks.map(t => '<a href="StudentTaskDetail.html?task=' + encodeURIComponent(t.id) + '" class="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-sky-300 transition">'
            + '<div class="flex items-start justify-between gap-3"><div><div class="font-semibold text-slate-900 text-sm">' + esc(t.title) + '</div><p class="text-[12.5px] text-slate-500 mt-1">' + esc(t.instructions || '') + '</p>'
            + '<div class="flex flex-wrap items-center gap-1.5 mt-2"><span class="text-[11.5px] text-slate-400 mr-1"><i class="fa-regular fa-calendar mr-1"></i>' + due(t) + '</span>' + files(t) + '</div></div>'
            + subBadge(t)
            + '</div></a>').join('') : '<div class="bg-white rounded-xl border border-slate-200 p-6 text-center text-[12.5px] text-slate-400">No tasks posted yet.</div>';
    }
    const t = document.getElementById('taskDetailTitle') && getAllTasks().find(x => x.id === new URLSearchParams(location.search).get('task'));
    if(t){
        document.getElementById('taskDetailTitle').textContent = t.title;
        document.getElementById('taskDetailInstructions').textContent = t.instructions || '';
        document.getElementById('taskDetailDue').innerHTML = '<i class="fa-regular fa-calendar mr-1"></i>' + due(t) + (t.maxPoints ? ' · ' + t.maxPoints + ' points' : '') + (t.status === 'closed' ? ' · submissions closed' : '');
        if(files(t)) document.getElementById('taskDetailDue').insertAdjacentHTML('afterend', '<div class="flex flex-wrap gap-1.5 mt-3">' + files(t) + '</div>' + (t.template ? '<p class="text-[11px] text-slate-400 mt-1.5">Download the template, fill it in, then paste or write your report below.</p>' : ''));
        const ta = document.getElementById('reportTextarea'), btn = document.getElementById('submitReportBtn');
        const renderMySub = () => {
            document.getElementById('mySubStatus')?.remove();
            const sub = mySub(t.id), g = getGrades()[gradeKey(t.id, me.name)];
            if(sub.raw && !ta.dataset.loaded){ ta.value = sub.raw; ta.dataset.loaded = '1'; ta.dispatchEvent(new Event('input')); }
            const locked = t.status === 'closed' || ['Pending Review', 'Verified', 'Rejected'].includes(sub.status);
            ta.readOnly = locked; btn.disabled = locked; btn.classList.toggle('opacity-50', locked); btn.classList.toggle('cursor-not-allowed', locked);
            if(!sub.status && t.status !== 'closed') return;
            document.getElementById('taskDetailTitle').parentElement.insertAdjacentHTML('beforeend', '<div id="mySubStatus" class="mt-3 text-[12.5px] rounded-md border px-3 py-2 ' + (sub.status ? SUB_CLASS[sub.status] : 'text-slate-500 bg-slate-50 border-slate-200') + '">'
                + (sub.status ? '<strong>' + sub.status + '</strong> · submitted ' + (sub.date ? formatDate(sub.date) : sub.meta.split(' · ')[0]) + (sub.status === 'Needs Revision' ? ' · edit your report and submit again' : '') : 'Submissions are closed.')
                + (sub.feedback ? '<div class="mt-1">Coordinator: “' + esc(sub.feedback) + '”</div>' : '')
                + (g ? '<div class="mt-1">Grade: ' + g.score + ' / ' + t.maxPoints + (g.feedback && g.feedback !== sub.feedback ? ' · ' + esc(g.feedback) : '') + '</div>' : '')
                + (sub.status === 'Verified' ? '<div class="mt-1">Added to your Verified Resume: “' + esc(sub.bullet) + '”</div>' : '') + '</div>');
        };
        renderMySub();
        btn.addEventListener('click', () => {
            if(btn.disabled) return;
            const raw = ta.value.trim();
            if(!raw) return showToast('Write your report first.', 'warn');
            const all = getJSON(SUB_KEY, {}), first = !mySub(t.id).status, p = mine();
            all[t.id] = (all[t.id] || []).filter(x => x.name !== me.name).concat({name: me.name, raw, bullet: draftBullet(raw), company: p.company, date: todayISO(), status: 'Pending Review'});
            localStorage.setItem(SUB_KEY, JSON.stringify(all));
            const st = getJSON(SUB_STATUS_KEY, {}); delete st[t.id + '|' + me.name]; localStorage.setItem(SUB_STATUS_KEY, JSON.stringify(st));
            if(first) updateTask(t.id, {turnedIn: (findTask(t.id).turnedIn || 0) + 1});
            showToast('Report submitted for coordinator approval.', 'success');
            renderMySub();
        });
    }

    // ---- Verified Resume: approved accomplishment reports ----
    const vbox = document.getElementById('pv-verified');
    if(vbox){
        const ver = allTaskIds().map(id => [id, mySub(id)]).filter(([, x]) => x.status === 'Verified' && x.bullet);
        vbox.innerHTML = ver.length ? ver.map(([id, x]) => '<div class="flex items-start justify-between gap-3 text-[13px] text-slate-600"><p>' + esc(x.bullet) + '</p><span class="text-[10.5px] text-slate-400 whitespace-nowrap">' + esc(taskInfo(id).title) + '</span></div>').join('')
            + '<p class="text-[10.5px] text-slate-400">Ask your coordinator if a verified entry needs changes.</p>'
            : '<p class="text-[12.5px] text-slate-400">Your approved accomplishment reports will appear here.</p>';
    }

    // ---- Notifications and Recent Activity ----
    function renderNotifs(){
        const p = mine(), items = [], st = getJSON(SUB_STATUS_KEY, {});
        (p.history || []).slice(-4).forEach(x => items.push({date: x.date, icon: 'fa-route', tone: 'bg-sky-50 text-sky-600', text: 'Placement: <strong>' + esc(x.status) + '</strong>' + (x.note ? ' · ' + esc(x.note) : '')}));
        allTaskIds().forEach(id => {
            const x = mySub(id);
            if(!x.status || x.status === 'Pending Review') return;
            items.push({date: (st[id + '|' + me.name] || {}).at || x.date || '', icon: x.status === 'Verified' ? 'fa-check' : 'fa-rotate-left', tone: x.status === 'Verified' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500',
                text: 'Your <strong>' + esc(taskInfo(id).title) + '</strong> was ' + ({'Verified': 'verified and added to your resume', 'Needs Revision': 'returned for revision', 'Rejected': 'rejected'})[x.status] + (x.feedback ? ': “' + esc(x.feedback) + '”' : '')});
        });
        myTasks().filter(t => t.status === 'open' && !mySub(t.id).status).forEach(t => items.push({date: t.dueDate, icon: 'fa-file-lines', tone: 'bg-indigo-50 text-indigo-500', text: '<strong>' + esc(t.title) + '</strong> is due ' + formatDate(t.dueDate)}));
        const today = liveRecs(me.name)[todayISO()];
        if(today) items.push({date: todayISO(), icon: 'fa-location-dot', tone: 'bg-emerald-50 text-emerald-500', text: 'You timed in at ' + fmtClock(today.in) + (today.out != null ? ' and out at ' + fmtClock(today.out) : '')});
        const del = p.status === 'Completed' ? getDeletionRequests().find(r => r.name === me.name) : null;
        if(del && del.status === 'held') items.push({date: del.heldAt, icon: 'fa-hand', tone: 'bg-amber-50 text-amber-500', text: 'Your deletion request is on hold: ' + esc(del.holdReason)});
        const top = items.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
        const empty = '<div class="px-4 py-3 text-[12.5px] text-slate-400">Nothing new yet.</div>';
        const drop = document.querySelector('#notifDropdown .divide-y');
        if(drop) drop.innerHTML = top.length ? top.map(x => '<div class="px-4 py-3 text-[12.5px] text-slate-700 hover:bg-slate-50">' + x.text + '<div class="text-[10.5px] text-slate-400 mt-0.5">' + (x.date ? formatDate(x.date) : '') + '</div></div>').join('') : empty;
        const recent = [...document.querySelectorAll('#tab-overview h2')].find(x => x.textContent.trim() === 'Recent Activity');
        const box = recent && recent.closest('.bg-white').querySelector('.divide-y');
        if(box) box.innerHTML = top.length ? top.map(x => '<div class="flex items-start gap-3 px-5 py-3"><div class="w-7 h-7 rounded-full ' + x.tone + ' flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fa-solid ' + x.icon + ' text-[11px]"></i></div>'
            + '<div class="text-[13px] text-slate-600">' + x.text + ' <span class="text-slate-400">· ' + (x.date ? formatDate(x.date) : '') + '</span></div></div>').join('') : empty;
    }
    renderNotifs();

    // ---- Day log (?date=YYYY-MM-DD) ----
    if(document.getElementById('dayLogDate')){
        const p = mine(), date = new URLSearchParams(location.search).get('date') || todayISO();
        const r = internAttendance(p).find(x => x.date === date);
        const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
        set('dayLogDate', new Date(date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}));
        const box = document.querySelector('#tab-daylog .h-40'), loc = document.querySelector('#tab-daylog .space-y-2 > div:nth-child(4) span:last-child');
        const off = !r || r.status === 'Absent' || r.status === 'Holiday';
        if(box && !off) box.innerHTML = '<img src="' + clockPhoto(p, r, 'in') + '" alt="Clock-in photo" class="h-full rounded-md"><img src="' + clockPhoto(p, r, 'out') + '" alt="Clock-out photo" class="h-full rounded-md ml-2">';
        set('dlIn', off ? '—' : fmtClock(r.timeIn));
        set('dlOut', off ? '—' : fmtClock(r.timeOut));
        set('dlHours', !r || r.status === 'Holiday' ? '—' : r.hours + ' hrs' + (r.review === 'rejected' ? ' (not counted)' : ''));
        if(loc) loc.innerHTML = !r ? '—' : r.status === 'Holiday' ? esc(r.place) : off ? '—' : '📍 ' + esc(r.place) + (r.dist != null ? ' · ' + r.dist + ' m from site' : '') + (r.lat ? '<div class="text-[11px] text-slate-400 text-right">' + r.lat + ', ' + r.lng + '</div>' : '');
        const dl = document.getElementById('dlStatus');
        if(dl){ dl.textContent = r ? r.status + (r.review ? ' · ' + r.review : '') : 'No record'; dl.className = 'text-[11px] font-semibold border px-2 py-0.5 rounded-full ' + (r ? ATT_BADGE[r.status] : 'text-slate-500 bg-slate-50 border-slate-200'); }
    }

    // ---- Today's time in / out state ----
    window.renderTodayClock = () => {
        const today = liveRecs(me.name)[todayISO()], p = mine();
        if(!today || !document.getElementById('timeInPrompt')) return;
        const showFlex = (id, yes) => { const el = document.getElementById(id); if(el){ el.classList.toggle('hidden', !yes); el.classList.toggle('flex', yes); } };
        showFlex('timeInPrompt', false);
        showFlex('timeInConfirmation', today.out == null);
        showFlex('timeOutConfirmation', today.out != null);
        const where = document.getElementById('timeInStamp')?.parentElement;
        if(where) where.innerHTML = '📍 ' + esc(siteFor(p).place) + (today.dist != null ? ' · ' + today.dist + ' m from site' : '') + ' · <span id="timeInStamp">' + fmtClock(today.in) + '</span>';
        if(today.photoIn){ const img = document.getElementById('timeInPhoto'); if(img) img.src = today.photoIn; showFlex('timeInPhotoPreview', true); }
        if(today.out != null){ set2('timeOutStamp', fmtClock(today.out)); set2('hoursTotal', today.hours); }
    };
    const set2 = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    window.renderTodayClock();

    // ---- Attendance: same records the coordinator sees ----
    window.renderStudentAttendance = () => {
    window.renderTodayClock();
    const body = document.getElementById('attendanceSummaryBody');
    if(body){
        const p = mine();
        const recs = ['Deployed', 'Hours complete', 'Completed'].includes(p.status) ? internAttendance(p) : [];
        const cal = document.getElementById('attendanceCalendar');
        if(!recs.length){
            body.innerHTML = '<tr><td colspan="7" class="px-5 py-6 text-center text-[12.5px] text-slate-400">' + (['Deployed', 'Hours complete'].includes(p.status) ? 'No clock-ins yet.' : 'Attendance starts after your coordinator confirms your deployment.') + '</td></tr>';
            document.getElementById('attendanceStats').innerHTML = '';
            if(cal) cal.innerHTML = '';
            return;
        }
        const n = (st) => recs.filter(r => r.status === st).length;
        const chip = (txt, tone) => '<span class="px-2.5 py-1 rounded-full border font-semibold ' + tone + '">' + txt + '</span>';
        document.getElementById('attendanceStats').innerHTML = chip(recs.filter(r => !['Absent', 'Holiday'].includes(r.status)).length + ' present', 'bg-emerald-50 text-emerald-700 border-emerald-200')
            + chip(n('Late') + ' late', 'bg-amber-50 text-amber-700 border-amber-200') + chip(n('Absent') + ' absent', 'bg-red-50 text-red-600 border-red-200')
            + (n('Flagged') ? chip(n('Flagged') + ' flagged', 'bg-red-50 text-red-600 border-red-200') : '') + chip((p.hours || 0) + ' / ' + REQUIRED_HOURS + ' hrs', 'bg-slate-100 text-slate-600 border-slate-200');
        body.innerHTML = recs.map(r => {
            const off = r.status === 'Absent' || r.status === 'Holiday';
            return '<tr class="cursor-pointer hover:bg-slate-50" data-date="' + r.date + '"><td class="px-5 py-3 text-slate-700 whitespace-nowrap">' + formatDate(r.date) + '</td>'
                + '<td class="px-5 py-3">' + (off ? '<span class="text-slate-300">—</span>' : '<img src="' + clockPhoto(p, r, 'in') + '" alt="Clock-in photo" class="w-7 h-9 rounded object-cover border border-slate-200">') + '</td>'
                + '<td class="px-5 py-3 whitespace-nowrap text-slate-600">' + (off ? '—' : fmtClock(r.timeIn)) + '</td><td class="px-5 py-3 whitespace-nowrap text-slate-600">' + (off ? '—' : fmtClock(r.timeOut)) + '</td>'
                + '<td class="px-5 py-3 text-[11.5px] text-slate-500">' + (r.status === 'Holiday' ? esc(r.place) : off ? '—' : esc(r.place) + (r.dist != null ? '<div class="text-[10.5px] ' + (r.dist > (r.radius || GEOFENCE_M) ? 'text-red-500' : 'text-slate-400') + '">' + r.dist + ' m from site</div>' : '')) + '</td>'
                + '<td class="px-5 py-3 font-medium whitespace-nowrap ' + (r.review === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-700') + '">' + (r.status === 'Holiday' ? '—' : r.hours + ' hrs') + '</td>'
                + '<td class="px-5 py-3"><span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + ATT_BADGE[r.status] + '">' + r.status + (r.review ? ' · ' + r.review : '') + '</span></td></tr>';
        }).join('');
        body.onclick = (e) => { const tr = e.target.closest('tr[data-date]'); if(tr) location.href = 'StudentDayLog.html?date=' + tr.dataset.date; };
        if(cal){
            const last = new Date(recs[0].date + 'T00:00:00'), y = last.getFullYear(), mo = last.getMonth();
            const head = cal.parentElement.querySelector('h2');
            if(head) head.textContent = last.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
            const byDate = Object.fromEntries(recs.map(r => [r.date, r]));
            let html = '';
            for(let i = 0; i < new Date(y, mo, 1).getDay(); i++) html += '<div class="cal-day empty"></div>';
            for(let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++){
                const r = byDate[isoDate(new Date(y, mo, d))], wd = new Date(y, mo, d).getDay();
                const cls = !r ? (wd === 0 || wd === 6 ? ' weekend' : '') : r.status === 'Absent' ? ' absent' : r.status === 'Holiday' ? ' weekend' : ' present';
                html += '<div class="cal-day' + cls + (r ? ' cursor-pointer' : '') + '"' + (r ? ' data-date="' + r.date + '"' : '') + ' title="' + (r ? r.status + (r.timeIn ? ' · ' + fmtClock(r.timeIn) + ' – ' + fmtClock(r.timeOut) : r.place ? ' · ' + esc(r.place) : '') : '') + '">' + d + (r ? '<span class="cal-dot"></span>' : '') + '</div>';
            }
            cal.innerHTML = html;
            cal.onclick = (e) => { const c = e.target.closest('[data-date]'); if(c) location.href = 'StudentDayLog.html?date=' + c.dataset.date; };
        }
    }
    };
    window.renderStudentAttendance();
});

// Saves a time in / time out from the student portal; returns the hours of the day
function saveLiveClock(name, kind, photo, coords){
    const p = placementList().find(x => x.name === name) || {};
    const site = siteFor(p);
    const now = new Date(), date = isoDate(now), mins = now.getHours() * 60 + now.getMinutes();
    const all = getJSON(LIVE_KEY, {}), mine = all[name] || {}, rec = mine[date] || {};
    const rad = (x) => x * Math.PI / 180;
    const dist = coords ? Math.round(2 * 6371000 * Math.asin(Math.sqrt(Math.sin(rad(coords.latitude - site.lat) / 2) ** 2 + Math.cos(rad(site.lat)) * Math.cos(rad(coords.latitude)) * Math.sin(rad(coords.longitude - site.lng) / 2) ** 2))) : null;
    if(kind === 'in') Object.assign(rec, {in: mins, photoIn: photo && photo.length < 250000 ? photo : '', lat: coords ? coords.latitude.toFixed(5) : '', lng: coords ? coords.longitude.toFixed(5) : '', dist});
    else {
        const span = mins - rec.in;
        Object.assign(rec, {out: mins, hours: Math.max(0, Math.round((span - (span > 300 ? 60 : 0)) / 6) / 10)});
    }
    mine[date] = rec; all[name] = mine;
    localStorage.setItem(LIVE_KEY, JSON.stringify(all));
    window.renderStudentAttendance?.();
    return rec.hours || 0;
}

// Coordinator Classwork: reports still waiting for review
if(document.getElementById('pendingLogsCount')) document.getElementById('pendingLogsCount').textContent = allTaskIds().reduce((n, id) => n + taskInfo(id).submissions.filter(x => x.status === 'Pending Review').length, 0);

/* ============ Partner directory: office location and geofence ============ */
function renderSiteLines(){
    document.querySelectorAll('.open-vault-btn').forEach(btn => {
        const c = btn.dataset.company, site = companySite(c), custom = !!getJSON(SITES_KEY, {})[c];
        btn.parentElement.querySelector('.site-line')?.remove();
        btn.insertAdjacentHTML('beforebegin', '<div class="site-line mt-3 flex items-center justify-between gap-2 text-[11.5px] border border-slate-200 rounded-md px-2.5 py-1.5">'
            + '<div class="min-w-0"><div class="text-slate-700 truncate"><i class="fa-solid fa-location-dot text-sky-600 mr-1"></i>' + esc(site.place) + '</div><div class="text-[10.5px] text-slate-400">Geofence ' + site.radius + ' m' + (custom ? '' : ' · sample pin, please confirm') + '</div></div>'
            + '<button class="site-edit-btn text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex-shrink-0" data-company="' + esc(c) + '">Edit</button></div>');
    });
}
function openSiteModal(company){
    let m = document.getElementById('siteModal');
    const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="siteModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 class="font-bold text-slate-900">Office location &amp; geofence</h3><button data-site="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p id="siteCompany" class="text-[12px] text-slate-500 mb-4"></p>'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mb-1" for="sitePlace">Place name</label><input id="sitePlace" class="' + field + ' mb-3">'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mb-1" for="siteCoords">Location</label><div class="flex gap-2 mb-1"><input id="siteCoords" placeholder="Paste a Google Maps link or lat, lng" class="' + field + '">'
          + '<button data-site="here" class="text-[11.5px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 rounded-md whitespace-nowrap" title="Use while you are at the company"><i class="fa-solid fa-crosshairs mr-1"></i>Use my location</button></div>'
          + '<a id="sitePreview" target="_blank" rel="noopener" class="text-[11.5px] text-sky-600 hover:underline"><i class="fa-solid fa-map-location-dot mr-1"></i>Check the pin on Google Maps</a>'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mt-3 mb-1" for="siteRadius">Geofence radius</label><select id="siteRadius" class="' + field + '">' + RADIUS_OPTIONS.map(r => '<option value="' + r + '">' + r + ' m</option>').join('') + '</select>'
          + '<p class="text-[11px] text-slate-400 mt-1.5">Use a bigger radius for large compounds or weak GPS indoors. Clock-ins outside it are flagged for your review. Past records keep their status.</p>'
          + '<div class="flex justify-end gap-2.5 mt-5"><button data-site="close" class="text-[12.5px] font-medium text-slate-500 hover:text-slate-700 px-3.5 py-2">Cancel</button><button data-site="save" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-md">Save</button></div></div></div>');
        m = document.getElementById('siteModal');
        const preview = () => { const c = parseCoords(document.getElementById('siteCoords').value); const a = document.getElementById('sitePreview'); a.classList.toggle('hidden', !c); if(c) a.href = mapsLink(c); };
        m.addEventListener('input', preview);
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-site]');
            if(!b) return;
            if(b.dataset.site === 'close'){ closeModal(m); return; }
            if(b.dataset.site === 'here'){
                if(!navigator.geolocation) return showToast('Location is not available on this device.', 'warn');
                navigator.geolocation.getCurrentPosition(pos => { document.getElementById('siteCoords').value = pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5); preview(); },
                    () => showToast('Location permission was not granted.', 'warn'), {enableHighAccuracy: true, timeout: 10000});
                return;
            }
            const c = parseCoords(document.getElementById('siteCoords').value), place = document.getElementById('sitePlace').value.trim(), radius = Number(document.getElementById('siteRadius').value);
            if(!c || !place) return showToast('Add the place name and a valid location.', 'warn');
            const all = getJSON(SITES_KEY, {});
            all[m._company] = {lat: c.lat, lng: c.lng, place, radius};
            localStorage.setItem(SITES_KEY, JSON.stringify(all));
            logAudit('Set the office location of ' + m._company + ' to ' + c.lat + ', ' + c.lng + ' (geofence ' + radius + ' m)');
            closeModal(m);
            renderSiteLines();
            showToast('Location saved. New clock-ins at ' + esc(m._company) + ' are checked against ' + radius + ' m.', 'success');
        });
    }
    const site = companySite(company);
    m._company = company;
    document.getElementById('siteCompany').textContent = company + ' · clock-ins are checked against this pin';
    document.getElementById('sitePlace').value = site.place;
    document.getElementById('siteCoords').value = site.lat + ', ' + site.lng;
    document.getElementById('siteRadius').value = String(site.radius);
    document.getElementById('sitePreview').href = mapsLink(site);
    openModal(m);
}
document.addEventListener('click', (e) => { const b = e.target.closest('.site-edit-btn'); if(b) openSiteModal(b.dataset.company); });
