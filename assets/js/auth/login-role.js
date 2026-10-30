// Restore the saved role before revealing the login form or loading portal scripts.
(function initLoginRole(){
    const storageKey = 'ic_login_role';
    const buttons = [...document.querySelectorAll('#roleSwitcher .role-btn')];
    const labels = {student: 'Student', coordinator: 'Coordinator', partnercompany: 'Industry Partner'};
    const form = document.getElementById('loginForm');
    let savedRole;
    try { savedRole = localStorage.getItem(storageKey); } catch(e) {}

    function selectRole(role){
        buttons.forEach(button => button.classList.toggle('active', button.dataset.role === role));
        document.getElementById('roleLabel').textContent = labels[role];
        const isPartner = role === 'partnercompany';
        document.getElementById('loginEmailLabel').textContent = isPartner ? 'Company email' : 'School email';
        document.getElementById('loginEmail').placeholder = isPartner ? 'name@company.com' : 'juandelacruz@sjxc.edu.ph';
    }

    // Commit the initial highlight without animating from the HTML's default state.
    buttons.forEach(button => { button.style.transition = 'none'; });
    selectRole(buttons.some(button => button.dataset.role === savedRole) ? savedRole : 'student');
    void form.offsetWidth;
    buttons.forEach(button => button.style.removeProperty('transition'));
    buttons.forEach(button => button.addEventListener('click', () => {
        selectRole(button.dataset.role);
        try { localStorage.setItem(storageKey, button.dataset.role); } catch(e) {}
    }));
    form.style.removeProperty('visibility');
})();
