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
    audit: 'CoordinatorAudit.html'
};

// Register Pages (per role, step 1 to 3)
const registerPages = {
    coordinator:    ['InternConnectCoordinatorRegister1.html', 'InternConnectCoordinatorRegister2.html', 'InternConnectCoordinatorRegister3.html'],
    student:        ['InternConnectStudentRegister1.html', 'InternConnectStudentRegister2.html', 'InternConnectStudentRegister3.html'],
    partnercompany: ['InternConnectPartnerRegister1.html', 'InternConnectPartnerRegister2.html', 'InternConnectPartnerRegister3.html']
};

// Where each role lands after login (key from "pages" above, null = dashboard not built yet)
const dashboards = { coordinator: 'overview', student: null, partnercompany: null };
const roleLabels = { student: 'Student', coordinator: 'Coordinator', partnercompany: 'Industry Partner' };

// Which role is this page for? (register pages have data-role on <body>, login uses the role switcher)
function currentRole(){
    if(document.body.dataset.role) return document.body.dataset.role;
    const active = document.querySelector('#roleSwitcher .role-btn.active');
    return active ? active.dataset.role : 'student';
}

// Turn a page key into a file name (register1/2/3 depend on the role)
function pageFor(key){
    const m = key.match(/^register([123])$/);
    return m ? registerPages[currentRole()][m[1] - 1] : pages[key];
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

if(sidebar){
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
    localStorage.setItem('ic_session', JSON.stringify({email: user.email, role: user.role, name: user.name, program: user.program, theme: user.theme, school: user.school || '', classCode: user.classCode || '', avatar: user.avatar || ''}));
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
        interns: members.filter(u => (u.status || 'intern') === 'intern').length,
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
    startSession(user || {role, email: email || 'demo@sjc.edu.ph', name: 'Demo User', program: 'BS Computer Science', theme: 'sky', school: 'PHINMA SJCDC', classCode: 'PHINMA-CS-2026'});
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
    if(!me || me.role !== 'coordinator'){
        if(REQUIRE_LOGIN) goTo('login', 'Please sign in first.', 'warn');
    } else {
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

// Alumni Deletion Requests: Process deletes profile data, Hold keeps what must be retained
document.addEventListener('click', (e) => {
    const process = e.target.closest('.del-process');
    const hold = e.target.closest('.del-hold');
    if(!process && !hold) return;
    const card = (process || hold).closest('[data-retain]');
    const name = card.querySelector('.font-semibold').textContent;
    if(process){
        card.remove();
        updateRequestCounts();
        showToast('Profile data of ' + name + ' deleted. OJT records kept until ' + card.dataset.retain + '.', 'success');
    } else {
        card.querySelector('.del-actions').innerHTML = '<span class="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">On hold: within retention period</span>';
        showToast('Request on hold. The alumni will see the reason and the date.', 'warn');
    }
});


/* ============ Classwork and Tasks ============ */

// Task Cards (open the task detail screen)
document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
        window.location.href = pages.taskdetail + '?task=' + card.dataset.task;
    });
});

// Create Task Modal
const taskModal = document.getElementById('taskModal');
on('openTaskModalBtn', 'click', () => taskModal.classList.remove('hidden'));
on('closeTaskModalBtn', 'click', () => taskModal.classList.add('hidden'));
on('cancelTaskBtn', 'click', () => taskModal.classList.add('hidden'));
on('repeatToggle', 'change', function(){
    document.getElementById('repeatIntervalRow').classList.toggle('hidden', !this.checked);
});
on('postTaskBtn', 'click', () => {
    taskModal.classList.add('hidden');
    showToast('Task posted to your class stream.', 'success');
});


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

// Grades are saved per task and per student: { 'week5|Aiyu T.': { score, feedback } }
const gradeKey = (taskId, name) => taskId + '|' + name;
const getGrades = () => getJSON('ic_grades', {});
function gradeText(taskId, name){
    const g = getGrades()[gradeKey(taskId, name)];
    return g ? ' · Graded ' + g.score + '/' + taskData[taskId].maxPoints : '';
}

let currentTaskId = 'week5';
let currentSubIndex = 0;

// Show One Submission On The Right Side
function renderSubmissionDetail(taskId, index){
    const sub = taskData[taskId].submissions[index];
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
    document.getElementById('gradeMax').textContent = taskData[taskId].maxPoints;
}

// Fill In The Whole Task Detail Screen
function renderTaskDetail(taskId){
    const t = taskData[taskId];
    currentTaskId = taskId;
    document.getElementById('taskDetailTitle').textContent = t.title;
    document.getElementById('taskDetailInstructions').textContent = t.instructions;
    document.getElementById('taskDetailDue').innerHTML = '<i class="fa-regular fa-calendar mr-1"></i>' + t.due;
    document.getElementById('taskDetailCount').textContent = t.count;
    const attEl = document.getElementById('taskDetailAttachment');
    if(t.attachment){
      attEl.style.display = '';
      attEl.innerHTML = '<i class="fa-solid fa-paperclip mr-1"></i><a href="#" class="text-sky-600 hover:underline">' + t.attachment + '</a>';
    } else {
      attEl.style.display = 'none';
    }
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
    if(t.submissions.length) renderSubmissionDetail(taskId, 0);
}

// Load The Task From The Link (taskdetail.html?task=week5)
if(document.getElementById('taskSubmissionsList')){
    const taskFromLink = new URLSearchParams(window.location.search).get('task');
    renderTaskDetail(taskData[taskFromLink] ? taskFromLink : 'week5');
}

on('backToClassworkBtn', 'click', () => goTo('classwork'));

// Approve, Revise, Reject and Export Buttons
on('td-approveBtn', 'click', () => {
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
    showToast(sub.name + "'s log approved and pushed to verified resume.", 'success');
});
on('td-reviseBtn', 'click', () => {
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
    showToast('Revision requested — ' + sub.name + ' will be notified.', 'warn');
});
on('td-rejectBtn', 'click', () => showToast('Log rejected.', 'warn'));
on('td-saveGradeBtn', 'click', () => {
    const t = taskData[currentTaskId];
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
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
    showToast('Generating PDF of ' + sub.name + "'s accomplishment report...", 'info');
});
on('td-genWordBtn', 'click', () => {
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
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
        .map(u => ({id: u.email, real: true, name: u.name, company: u.company || '—', hours: u.hours || 0,
                    status: u.status || 'intern', completedAt: u.completedAt, withdrawnAt: u.withdrawnAt, employment: u.employment || 'seeking'}));
    rosterMembers = real.concat(sampleMembers.map(m => Object.assign({sample: true}, m)));
}
function memberName(m){
    return '<div class="font-semibold text-slate-900">' + esc(m.name) + '</div>';
}
function setMember(m, patch){
    Object.assign(m, patch);
    if(m.real) updateUser(m.id, 'student', patch);
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
        return '<tr><td class="px-4 py-3">' + memberName(m) + '</td>'
          + '<td class="px-4 py-3 text-slate-600">' + esc(m.company) + '</td>'
          + '<td class="px-4 py-3"><div class="flex items-center gap-2"><div class="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-sky-600" style="width:' + pct + '%"></div></div><span class="text-[11.5px] text-slate-500">' + m.hours + ' / ' + REQUIRED_HOURS + '</span></div></td>'
          + '<td class="px-4 py-3"><div class="flex gap-2">'
          + '<button data-act="complete" data-id="' + esc(m.id) + '" ' + (done ? '' : 'disabled title="Hours not complete yet"') + ' class="text-[11px] font-semibold px-2.5 py-1 rounded-md transition ' + (done ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 cursor-not-allowed') + '">Mark completed</button>'
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
        if(btn.dataset.act === 'complete'){
            setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking'});
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
        const ready = rosterMembers.filter(m => m.status === 'intern' && m.hours >= REQUIRED_HOURS);
        const ongoing = rosterMembers.filter(m => m.status === 'intern').length - ready.length;
        if(!confirm('Close this batch? ' + ready.length + ' intern(s) with complete hours will become alumni. ' + ongoing + ' will stay until they finish. No new students can join.')) return;
        ready.forEach(m => setMember(m, {status: 'alumni', completedAt: todayISO(), employment: 'seeking'}));
        updateClass(activeClassCode(), {status: 'closed'});
        renderRoster();
        showToast('Batch closed. ' + ready.length + ' moved to Alumni, ' + ongoing + ' still ongoing.', 'success');
    });
}


/* ============ Attendance and Progress ============ */

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


/* ============ Partner and MOA Directory ============ */

// Partner Vault Modal (coordinator-owned files are editable, HR-owned files need an access request)
const vaultModal = document.getElementById('vaultModal');
document.querySelectorAll('.open-vault-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const company = btn.dataset.company;
      document.getElementById('vaultCompanyName').textContent = company;
      document.getElementById('vaultMoaFileName').textContent = 'MOA_' + company.replace(/\s+/g, '_') + '_2026.pdf';
      vaultModal.classList.remove('hidden');
    });
});
on('closeVaultModalBtn', 'click', () => vaultModal.classList.add('hidden'));

document.querySelectorAll('.request-file-access').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileName = btn.closest('[data-owner]').querySelector('.text-slate-700').textContent;
      const company = document.getElementById('vaultCompanyName').textContent;
      showToast('Access request for "' + fileName + '" sent to ' + company + "'s HR contact.", 'info');
    });
});

on('vaultUploadBtn', 'click', () => {
    const list = document.getElementById('vaultFileList');
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between border border-slate-200 rounded-md px-3 py-2.5';
    row.dataset.owner = 'coordinator';
    row.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <i class="fa-solid fa-file-pdf text-red-500 flex-shrink-0"></i>
        <div class="min-w-0">
          <div class="text-[12.5px] text-slate-700 truncate">New_Document.pdf</div>
          <div class="text-[10.5px] text-slate-400">Uploaded by you</div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <i class="fa-solid fa-download text-slate-400 hover:text-slate-600 cursor-pointer"></i>
        <button class="text-[10.5px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-md transition"><i class="fa-solid fa-pen mr-1"></i>Edit</button>
      </div>`;
    list.appendChild(row);
    showToast('File uploaded to vault — you own this file and can edit it anytime.', 'success');
});