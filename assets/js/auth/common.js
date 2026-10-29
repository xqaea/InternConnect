// Where each role lands after login (key from "pages" above, null = dashboard not built yet)
const dashboards = { coordinator: 'overview', student: 'overview', partnercompany: 'poverview' };
const roleLabels = { student: 'Student', coordinator: 'Coordinator', partnercompany: 'Industry Partner' };

// Sign In Draft (the data typed across register steps 1 to 3)
function getDraft(){ try { return JSON.parse(sessionStorage.getItem('ic_reg')) || {}; } catch(e){ return {}; } }
function saveDraft(patch){ sessionStorage.setItem('ic_reg', JSON.stringify(Object.assign(getDraft(), patch))); }

// Save who is logged in (theme included) then open their dashboard
function startSession(user, message){
    if(['student', 'coordinator'].includes(user.role) && user.databaseAccount){
        const users = getUsers();
        const old = users.find(record => record.role === user.role && record.email.toLowerCase() === user.email.toLowerCase()) || {};
        if(user.role === 'student' && user.status === 'active' && ['intern', 'alumni', 'alumni_pending'].includes(old.status)) user = {...user, status: old.status};
        const cached = Object.assign({}, old, user);
        delete cached.password;
        saveUsers(users.filter(record => !(record.role === user.role && record.email.toLowerCase() === user.email.toLowerCase())).concat(cached));
    }
    localStorage.setItem('ic_session', JSON.stringify({
        email: user.email, role: user.role, name: user.name, program: user.program,
        theme: user.theme, school: user.school || '', classCode: user.classCode || '',
        avatar: user.avatar || '', status: user.status || 'active', hours: Number(user.hours || user.ojtHours || 0),
        ojtHours: Number(user.ojtHours || user.hours || 0), completedAt: user.completedAt || '',
        company: user.company || '', category: user.category || '', studentNumber: user.studentNumber || '', sharedPostings: !!user.sharedPostings, databaseAccount: !!user.databaseAccount
    }));
    applyTheme(user.theme);
    const dest = dashboards[user.role];
    if(dest) goTo(dest, message, 'success');
    else showToast((message ? message + ' ' : '') + 'The ' + roleLabels[user.role] + ' dashboard is not built yet.', 'info');
}


// Enter submits the login, forgot password and sign up steps (these pages have no <form>)
if(NO_PAGE_DISCARD) document.addEventListener('keydown', (e) => {
    if(e.key !== 'Enter' || e.isComposing || !e.target.matches || !e.target.matches('input:not([type=checkbox]):not([type=radio]), select') || document.querySelector('[data-ask]')) return;
    const b = ['loginSubmitBtn', 'sendResetLinkBtn', 'regNext1', 'regNext2', 'enterDashboardBtn'].map(id => document.getElementById(id)).find(x => x && !x.disabled);
    if(b){ e.preventDefault(); b.click(); }
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

function passwordRequirements(password){
    return [
        [password.length >= 8, 'at least 8 characters'],
        [/[A-Z]/.test(password), 'an uppercase letter'],
        [/[a-z]/.test(password), 'a lowercase letter'],
        [/[0-9]/.test(password), 'a number'],
        [/[^A-Za-z0-9]/.test(password), 'a special character']
    ];
}



function registrationEmailError(email, role, usePersonalEmail){
    const hasValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@.]+(?:\.[^\s@.]+)*$/i.test(email);
    const hasAllowedEnding = /\.(?:edu|edu\.ph|com)$/i.test(email);
    if(!hasValidFormat || !hasAllowedEnding) return 'Use a valid email ending in .edu, .edu.ph, or .com.';
    return '';
}
