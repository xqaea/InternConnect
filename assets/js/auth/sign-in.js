/* ============ Login ============ */

let loginSubmitting = false;
let loginNavigating = false;
function setLoginLoading(loading){
    const form = document.getElementById('loginForm');
    form?.classList.toggle('login-loading', loading);
    form?.setAttribute('aria-busy', String(loading));
    const content = document.getElementById('loginContent');
    if(content) content.inert = loading;
    const skeleton = document.getElementById('loginLoading');
    if(skeleton) skeleton.hidden = !loading;
}
let loginWasLocked = false;
function showLoginError(message){
    const box = document.getElementById('loginError');
    box.querySelector('span').textContent = message;
    box.classList.remove('hidden'); box.classList.add('flex');
}
function refreshLoginLockout(){
    const button = document.getElementById('loginSubmitBtn');
    if(!button) return;
    const state = window.ICLoginLockout.status(currentRole(), document.getElementById('loginEmail').value);
    button.disabled = loginSubmitting || state.seconds > 0;
    button.classList.toggle('opacity-60', button.disabled);
    button.classList.toggle('cursor-not-allowed', button.disabled);
    if(state.seconds){
        const minutes = Math.floor(state.seconds / 60), seconds = String(state.seconds % 60).padStart(2, '0');
        showLoginError('Too many failed attempts. Try again in ' + minutes + ':' + seconds + '.');
    }else if(loginWasLocked){
        document.getElementById('loginError').classList.add('hidden');
    }
    loginWasLocked = state.seconds > 0;
}
if(document.getElementById('loginSubmitBtn')){
    refreshLoginLockout();
    setInterval(refreshLoginLockout, 1000);
    document.getElementById('loginEmail').addEventListener('input', () => {
        document.getElementById('loginError').classList.add('hidden'); refreshLoginLockout();
    });
    document.querySelectorAll('#roleSwitcher .role-btn').forEach(button => button.addEventListener('click', () => {
        document.getElementById('loginError').classList.add('hidden'); refreshLoginLockout();
    }));
    window.addEventListener('storage', refreshLoginLockout);
}

// Local prototype demos use explicit credentials; unknown accounts are failed logins.
on('loginSubmitBtn', 'click', async () => {
    if(loginSubmitting) return;
    const role = currentRole();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pw = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginError');
    const limits = window.ICLoginLockout;
    if(limits.status(role, email).seconds){ refreshLoginLockout(); return; }
    if(!email || !pw){ showLoginError('Enter your email and password.'); return; }
    const failure = remaining => {
        const state = limits.fail(role, email);
        if(!state.seconds) showLoginError('Incorrect email or password. ' + (remaining ?? (5 - state.failures)) + ' attempts remaining.');
        refreshLoginLockout();
    };
    const user = getUsers().find(u => u.role === role && u.email.toLowerCase() === email);
    const isDemo = !user && email === 'demo@sjc.edu.ph' && pw === 'DemoAccess2026!';
    loginSubmitting = true;
    errorBox.classList.add('hidden');
    setLoginLoading(true);
    refreshLoginLockout();
    try{
        sessionStorage.removeItem('ic_postings_token');
        if(!isDemo){
            try{
                const api = {student: window.ICStudentApi, coordinator: window.ICCoordinatorApi, partnercompany: window.ICPostingApi}[role];
                const result = await api.login(email, pw);
                limits.reset(role, email);
                sessionStorage.removeItem('ic_student_token');
                sessionStorage.removeItem('ic_coordinator_token');
                sessionStorage.setItem({student: 'ic_student_token', coordinator: 'ic_coordinator_token', partnercompany: 'ic_postings_token'}[role], result.token);
                startSession(result.user);
                loginNavigating = true;
                return;
            }catch(error){
                if(error.status === 429){
                    limits.block(role, email, error.retryAfter || 300);
                    refreshLoginLockout();
                    return;
                }
                if(error.status === 401){ failure(error.remainingAttempts); return; }
                if(error.status === 422){
                    showLoginError('Invalid email or password');
                    return;
                }
                if(error.status === 403) limits.reset(role, email);
                if(error.status && error.status !== 503){
                    showLoginError(error.message);
                    return;
                }
                // Outages are not incorrect credentials and must not consume attempts.
                showLoginError('Sign-in service is unavailable. Please try again shortly.');
                return;
            }
        }
        sessionStorage.removeItem('ic_student_token');
        sessionStorage.removeItem('ic_coordinator_token');
        if(!isDemo && (!user || user.password !== pw)){
            failure();
            return;
        }
        limits.reset(role, email);
        errorBox.classList.add('hidden');
        if(user && user.status === 'pending'){
            return showToast('Your request to join the class is still waiting for coordinator approval.', 'warn');
        }
        const demo = {role, email: email || 'demo@sjc.edu.ph', name: 'Demo User', program: 'BS Computer Science', theme: 'sky', school: 'PHINMA SJCDC', classCode: 'PHINMA-CS-2026'};
        if(role === 'student') Object.assign(demo, {name: 'Alex V. Santos', status: 'intern', hours: 320, ojtHours: 320});
        if(role === 'partnercompany') Object.assign(demo, {name: 'Sarah Geronimo', company: 'Brightpath Software'});
        startSession(user || demo);
        loginNavigating = true;
    }finally{
        loginSubmitting = false;
        if(!loginNavigating) setLoginLoading(false);
        refreshLoginLockout();
    }
});
window.addEventListener('pageshow', event => {
    if(event.persisted){ loginNavigating = false; loginSubmitting = false; setLoginLoading(false); refreshLoginLockout(); }
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
