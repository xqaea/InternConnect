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
// Student / Partner -> server validates the batch and creates a pending account.
on('enterDashboardBtn', 'click', async () => {
    const role = currentRole();
    const draft = getDraft();
    const code = document.getElementById('regClassCode').value.trim();
    if(!draft.Email) { goTo('register1'); return; }   // skipped the earlier steps
    const emailError = registrationEmailError(draft.Email, role, draft.UsePersonalEmail === true);
    if(emailError) return goTo('register2', emailError, 'warn');
    if(!code) return showToast(role === 'coordinator' ? 'Generate or type a class code first.' : 'Enter your class code first.', 'warn');

    if(role === 'student'){
        const button = document.getElementById('enterDashboardBtn');
        if(button.disabled) return;
        button.disabled = true;
        try{
            await window.ICStudentApi.register({email: draft.Email, password: draft.Password,
                name: draft.FirstName + ' ' + draft.LastName, studentNumber: draft.StudentNumber || '',
                classCode: code, program: draft.Program, schoolEmail: draft.SchoolEmail || '',
                personalEmail: draft.PersonalEmail || '', avatar: draft.avatar || ''});
            sessionStorage.removeItem('ic_reg');
            localStorage.setItem('ic_login_role', 'student');
            goTo('login', 'Account created. Your class membership is waiting for approval.', 'success');
        }catch(error){
            showToast(error.message || 'Could not create the account. Please try again.', 'warn');
        }finally{ button.disabled = false; }
        return;
    }

    if(role === 'coordinator'){
        const button = document.getElementById('enterDashboardBtn');
        if(button.disabled) return;
        button.disabled = true;
        try{
            await window.ICCoordinatorApi.register({email: draft.Email, password: draft.Password,
                name: draft.FirstName + ' ' + draft.LastName, classCode: code, program: draft.Program,
                school: draft.SchoolName, theme: document.querySelector('.theme-dot.active').dataset.theme,
                schoolEmail: draft.SchoolEmail || '', personalEmail: draft.PersonalEmail || '', avatar: draft.avatar || ''});
            sessionStorage.removeItem('ic_reg');
            localStorage.setItem('ic_login_role', 'coordinator');
            goTo('login', 'Coordinator account and batch created. Sign in to continue.', 'success');
        }catch(error){ showToast(error.message || 'Could not create the coordinator account.', 'warn'); }
        finally { button.disabled = false; }
        return;
    }

    if(role === 'partnercompany'){
        const button = document.getElementById('enterDashboardBtn');
        if(button.disabled) return;
        button.disabled = true;
        try{
            await window.ICPostingApi.register({email: draft.Email, password: draft.Password,
                name: draft.FirstName + ' ' + draft.LastName, classCode: code,
                company: draft.CompanyName || '', category: draft.Category || '',
                program: draft.Program || draft.Category || '', avatar: draft.avatar || ''});
            sessionStorage.removeItem('ic_reg');
            localStorage.setItem('ic_login_role', 'partnercompany');
            goTo('login', 'Account created. Your coordinator must approve it before you can sign in.', 'success');
        }catch(error){ showToast(error.message || 'Could not create the partner account.', 'warn'); }
        finally { button.disabled = false; }
    }
});
