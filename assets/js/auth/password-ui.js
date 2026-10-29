// Shared password visibility control and registration feedback.
(function initPasswordVisibility(){
    ['loginPassword', 'regPassword', 'regPasswordConfirm'].forEach(id => {
        const input = document.getElementById(id);
        if(!input || input.parentElement.classList.contains('password-input-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'password-input-wrap';
        input.parentElement.insertBefore(wrap, input);
        wrap.appendChild(input);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'password-visibility-btn';
        button.setAttribute('aria-label', 'Show password');
        button.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
        button.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
            button.innerHTML = '<i class="fa-solid ' + (visible ? 'fa-eye' : 'fa-eye-slash') + '" aria-hidden="true"></i>';
        });
        wrap.appendChild(button);
    });
})();

(function initPasswordStrength(){
    const input = document.getElementById('regPassword');
    if(!input) return;
    const feedback = document.createElement('div');
    feedback.className = 'password-strength';
    feedback.innerHTML = '<div class="password-strength-track" role="meter" aria-label="Password strength" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0"><div class="password-strength-fill"></div></div><p id="passwordStrengthLabel" class="password-strength-label" aria-live="polite"></p><p id="passwordStrengthHint" class="password-strength-hint"></p>';
    const inputWrap = input.closest('.password-input-wrap');
    if(inputWrap) inputWrap.after(feedback);
    else input.after(feedback);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), 'passwordStrengthLabel', 'passwordStrengthHint'].filter(Boolean).join(' '));
    const meter = feedback.querySelector('[role="meter"]');
    const checklist = document.createElement('ul');
    checklist.id = 'passwordRequirements';
    checklist.className = 'password-requirements';
    checklist.setAttribute('aria-label', 'Password requirements');
    const requirementItems = passwordRequirements('').map(([, label]) => {
        const item = document.createElement('li');
        const icon = document.createElement('span');
        icon.className = 'password-requirement-icon';
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        item.append(icon, text);
        checklist.appendChild(item);
        return {item, icon, label};
    });
    feedback.appendChild(checklist);
    input.setAttribute('aria-describedby', input.getAttribute('aria-describedby') + ' passwordRequirements');
    const update = () => {
        const password = input.value;
        const requirements = passwordRequirements(password);
        const missing = requirements.filter(([met]) => !met).map(([, label]) => label);
        checklist.hidden = missing.length === requirements.length;
        requirements.forEach(([met], index) => {
            const {item, icon, label} = requirementItems[index];
            item.hidden = !met;
            item.classList.toggle('is-met', met);
            item.setAttribute('aria-label', (met ? 'Met: ' : 'Not met: ') + label);
            icon.textContent = met ? '\u2713' : '';
        });
        const level = !password ? 0 : password.length < 8 || missing.length > 1 ? 1 : missing.length || password.length < 12 ? 2 : 3;
        const label = ['Enter a password', 'Weak', 'Fair', 'Strong'][level];
        feedback.dataset.level = level;
        meter.setAttribute('aria-valuenow', String(level));
        meter.setAttribute('aria-valuetext', label);
        feedback.querySelector('.password-strength-label').textContent = password ? 'Password strength: ' + label : label;
        feedback.querySelector('.password-strength-hint').textContent = missing.length ? 'Use ' + missing.join(', ') + '.' : '';
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    window.addEventListener('pageshow', update);
    update();
})();
