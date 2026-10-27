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
    const emailError = registrationEmailError(draft.Email, role, draft.UsePersonalEmail === true);
    if(emailError) return goTo('register2', emailError, 'warn');
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
        if(found.program !== draft.Program) return showToast(role === 'partnercompany'
            ? 'This class code is for ' + found.program + '. Choose a class code matching your industry category.'
            : 'This class code is for ' + found.program + ', not your program.', 'warn');
        if((found.status || 'active') !== 'active') return showToast('This batch is ' + found.status + ' and no longer accepts new students. Ask your coordinator for a new class code.', 'warn');
        theme = found.theme;
        school = found.school || '';
    }

    const user = {role, email: draft.Email, schoolEmail: draft.SchoolEmail || '', personalEmail: draft.PersonalEmail || '', password: draft.Password, name: draft.FirstName + ' ' + draft.LastName,
                  program: draft.Program, theme, school, classCode: code, avatar: draft.avatar || '',
                  status: role === 'coordinator' ? 'active' : 'pending', requestedAt: todayISO(),   // students and partners wait for the coordinator
                  company: draft.CompanyName || '', category: role === 'partnercompany' ? draft.Category || '' : '', studentNumber: draft.StudentNumber || ''};
    saveUsers(getUsers().concat(user));
    sessionStorage.removeItem('ic_reg');
    startSession(user, 'Account created. Welcome to InternConnect!');
});
