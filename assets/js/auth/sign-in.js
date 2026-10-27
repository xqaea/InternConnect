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
    if(role === 'partnercompany') Object.assign(demo, {name: 'Sarah Geronimo', company: 'Brightpath Software'});
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
