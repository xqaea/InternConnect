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
    const state = window.ICLoginLockout.status('login', document.getElementById('loginEmail').value);
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
    window.addEventListener('storage', refreshLoginLockout);
}

// The server identifies the account type and enforces the shared email lockout.
on('loginSubmitBtn', 'click', async () => {
    if(loginSubmitting) return;
    const role = 'login';
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
    loginSubmitting = true;
    errorBox.classList.add('hidden');
    setLoginLoading(true);
    refreshLoginLockout();
    try{
        try{
            const result = await window.ICAuthApi.login(email, pw);
            const tokenKey = {student:'ic_student_token', coordinator:'ic_coordinator_token', partnercompany:'ic_postings_token'}[result.user?.role];
            if(!tokenKey || !result.token) throw new Error('Invalid sign-in response.');
            limits.reset(role, email);
            ['ic_student_token','ic_coordinator_token','ic_postings_token'].forEach(key => sessionStorage.removeItem(key));
            sessionStorage.setItem(tokenKey, result.token);
            startSession(result.user);
            loginNavigating = true;
        }catch(error){
            if(error.status === 429){
                limits.block(role, email, error.retryAfter || 300);
                refreshLoginLockout();
            }else if(error.status === 401){ failure(error.remainingAttempts); }
            else if(error.status === 422){ showLoginError('Invalid email or password'); }
            else if(error.status && error.status !== 503){
                if(error.status === 403 || error.status === 409) limits.reset(role, email);
                showLoginError(error.message);
            }else{
                showLoginError('Sign-in service is unavailable. Please try again shortly.');
            }
        }
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
    const choices = document.getElementById('registrationChoices');
    if(choices){
        const hidden = choices.classList.toggle('hidden');
        document.getElementById('goToRegisterLink').setAttribute('aria-expanded', String(!hidden));
    }
});
on('forgotPasswordLink', 'click', () => goTo('forgotpw'));
on('goToLoginLink', 'click', () => goTo('login'));
on('backToLoginFromForgot', 'click', () => goTo('login'));

// Forgot Password
on('sendResetLinkBtn', 'click', () => {
    document.getElementById('forgotPwSent').classList.remove('hidden');
    document.getElementById('forgotPwSent').classList.add('flex');
});
