// Page Names 
const pages = {
    login: 'InternConnectLogin.html',
    forgotpw: 'InternConnectForgotPassword.html',
    overview: 'CoordinatorOverview.html',
    waitingroom: 'CoordinatorWaitingRoom.html',
    classwork: 'CoordinatorClasswork.html',
    taskdetail: 'CoordinatorTaskDetail.html',
    attendance: 'CoordinatorAttendance.html',
    approvals: 'CoordinatorApproval.html',
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
    const code = (getJSON('ic_session', null) || {}).classCode || 'PHINMA-CS-2026';
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
    const mismatch = !pw || pw !== pwConfirm;
    document.getElementById('regPasswordMismatch').classList.toggle('hidden', !mismatch);
    document.getElementById('codeError').classList.toggle('hidden', code.length >= 6);
    showStep2Error('');
    if(!email) return showStep2Error('Enter your email first.');
    if(getUsers().some(u => u.role === currentRole() && u.email.toLowerCase() === email.toLowerCase())){
        return showStep2Error('This email is already registered. Use a different email, or sign in instead.');
    }
    if(mismatch || code.length < 6) return;
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
    const code = 'CS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
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
        classes[code] = {program: draft.Program, theme, school: draft.SchoolName, coordinator: draft.Email};
        localStorage.setItem('ic_classes', JSON.stringify(classes));
    } else {
        const found = all[code];
        if(!found) return showToast('Invalid class code. Ask your coordinator for the correct one.', 'warn');
        if(found.program !== draft.Program) return showToast('This class code is for ' + found.program + ', not your program.', 'warn');
        theme = found.theme;
        school = found.school || '';
    }

    const user = {role, email: draft.Email, password: draft.Password, name: draft.FirstName + ' ' + draft.LastName,
                  program: draft.Program, theme, school, classCode: code, avatar: draft.avatar || ''};
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
            classcode: me.classCode
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


/* ============ Waiting Room ============ */

// Sub Tabs
document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.subtab).classList.remove('hidden');
    });
});

// Approve and Reject Requests
document.querySelectorAll('.join-approve').forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.closest('div.flex.items-center.justify-between').querySelector('.font-semibold').textContent;
        btn.closest('.bg-white').remove();
        showToast(name + ' approved and added to the class.', 'success');
    });
});
document.querySelectorAll('.join-reject').forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.closest('div.flex.items-center.justify-between').querySelector('.font-semibold').textContent;
        btn.closest('.bg-white').remove();
        showToast(name + "'s request was rejected.", 'warn');
    });
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
      item.innerHTML = '<div class="text-[12.5px] font-semibold text-slate-900">' + sub.name + '</div><div class="text-[10.5px] text-slate-400">' + sub.status + '</div>';
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
on('td-genPdfBtn', 'click', () => {
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
    showToast('Generating PDF of ' + sub.name + "'s accomplishment report...", 'info');
});
on('td-genWordBtn', 'click', () => {
    const sub = taskData[currentTaskId].submissions[currentSubIndex];
    showToast('Generating Word document of ' + sub.name + "'s accomplishment report...", 'info');
});


/* ============ Report Approvals ============ */

// Select All
on('selectAll', 'change', function(){
    document.querySelectorAll('.log-item input[type="checkbox"]').forEach(cb => cb.checked = this.checked);
});

// Highlight The Clicked Log
document.querySelectorAll('.log-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if(e.target.tagName === 'INPUT') return;
        document.querySelectorAll('.log-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
    });
});

// Approve and Reject Selected
function countSelectedLogs(){
    return document.querySelectorAll('.log-item input[type="checkbox"]:checked').length;
}
on('approveSelectedBtn', 'click', () => {
    const n = countSelectedLogs();
    if(!n) return showToast('Select at least one log first.', 'warn');
    showToast(n + ' log(s) approved and pushed to verified resumes.', 'success');
});
on('rejectSelectedBtn', 'click', () => {
    const n = countSelectedLogs();
    if(!n) return showToast('Select at least one log first.', 'warn');
    showToast(n + ' log(s) rejected.', 'warn');
});


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