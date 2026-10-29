function registrationEmailData(){
    const usePersonal = !!document.getElementById('regUsePersonalEmail')?.checked;
    const schoolEmail = document.getElementById('regEmail').value.trim();
    const personalEmail = document.getElementById('regPersonalEmail')?.value.trim() || '';
    return {Email: usePersonal ? personalEmail : schoolEmail, SchoolEmail: currentRole() === 'partnercompany' ? '' : schoolEmail,
        PersonalEmail: personalEmail, UsePersonalEmail: usePersonal};
}

(function initRegistrationEmail(){
    const toggle = document.getElementById('regUsePersonalEmail');
    if(!toggle) return;
    const draft = getDraft();
    toggle.checked = draft.UsePersonalEmail === true;
    if(draft.SchoolEmail !== undefined) document.getElementById('regEmail').value = draft.SchoolEmail;
    const update = () => {
        const school = document.getElementById('regEmail');
        const personal = document.getElementById('regPersonalEmail');
        school.disabled = toggle.checked;
        school.required = !toggle.checked;
        personal.disabled = !toggle.checked;
        personal.required = toggle.checked;
        document.getElementById('personalEmailFields').classList.toggle('hidden', !toggle.checked);
    };
    toggle.addEventListener('change', update);
    update();
})();

(function initRegistrationCodeVisibility(){
    const code = document.getElementById('regCode');
    if(!code) return;
    const update = () => {
        const data = registrationEmailData();
        const email = data.Email.toLowerCase();
        const valid = !registrationEmailError(data.Email, currentRole(), data.UsePersonalEmail);
        const sent = valid && code.dataset.sentEmail === email;
        document.getElementById('sendCodeBtn').textContent = sent ? 'Enter Code' : 'Send Code';
        document.getElementById('regCodeFields').classList.toggle('hidden', !sent);
        document.getElementById('resendCodeLink').classList.toggle('hidden', !sent);
        code.disabled = !sent;
        if(!sent){
            delete code.dataset.sentEmail;
            code.value = '';
            document.getElementById('codeError').classList.add('hidden');
        }
    };
    ['regEmail', 'regPersonalEmail', 'regUsePersonalEmail'].forEach(id => {
        on(id, 'input', update);
        on(id, 'change', update);
    });
    window.addEventListener('pageshow', update);
    update();
})();

// Step 2: Back / Send Code / Resend / Next
on('regBack2', 'click', () => {
    saveDraft(registrationEmailData());
    goTo('register1');
});
// Temporary confirmation code for the local registration prototype.
const REGISTRATION_TEST_CODE = '123456';
function sendRegistrationCode(){
    const data = registrationEmailData();
    const error = registrationEmailError(data.Email, currentRole(), data.UsePersonalEmail);
    showStep2Error(error);
    if(error) return;
    const code = document.getElementById('regCode');
    code.dataset.sentEmail = data.Email.toLowerCase();
    code.disabled = false;
    document.getElementById('sendCodeBtn').textContent = 'Enter Code';
    document.getElementById('regCodeFields').classList.remove('hidden');
    document.getElementById('resendCodeLink').classList.remove('hidden');
    showToast('Testing: use confirmation code ' + REGISTRATION_TEST_CODE + ' for ' + data.Email + '.', 'info');
    code.focus();
}
on('sendCodeBtn', 'click', () => {
    const email = registrationEmailData().Email.toLowerCase();
    if(document.getElementById('regCode').dataset.sentEmail === email){
        continueRegistrationStep2();
    } else {
        sendRegistrationCode();
    }
});
on('resendCodeLink', 'click', sendRegistrationCode);
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

function continueRegistrationStep2(){
    const emailData = registrationEmailData();
    const email = emailData.Email;
    const emailError = registrationEmailError(email, currentRole(), emailData.UsePersonalEmail);
    if(emailError) return showStep2Error(emailError);
    if(document.getElementById('regCode').dataset.sentEmail !== email.toLowerCase()){
        return showStep2Error('Click Send Code before entering your confirmation code.');
    }
    const pw = document.getElementById('regPassword').value;
    const pwConfirm = document.getElementById('regPasswordConfirm').value;
    const code = document.getElementById('regCode').value.trim();
    const codeValid = code === REGISTRATION_TEST_CODE;
   const passwordValid = passwordRequirements(pw).every(([met]) => met);

const mismatch = !pw || pw !== pwConfirm;

document.getElementById('regPasswordMismatch').classList.toggle(
    'hidden',
    !mismatch
);

document.getElementById('codeError').classList.toggle(
    'hidden',
    codeValid
);
document.getElementById('codeError').textContent = 'Incorrect confirmation code. For testing, enter ' + REGISTRATION_TEST_CODE + '.';

showStep2Error('');

if (!passwordValid) {
    return showStep2Error(
        'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.'
    );
}
    showStep2Error('');
    if(!email) return showStep2Error('Enter your email first.');
    if(currentRole() === 'partnercompany' && getUsers().some(u => u.role === currentRole() && u.email.toLowerCase() === email.toLowerCase())){
        return showStep2Error('This email is already registered. Use a different email, or sign in instead.');
    }
    if(!passwordValid || mismatch || !codeValid) return;
    saveDraft({...emailData, Password: pw});
    goTo('register3');
}
on('regNext2', 'click', continueRegistrationStep2);
