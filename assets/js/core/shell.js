/* ============ Dashboard Profile (coordinator pages) ============ */

const REQUIRE_LOGIN = true;   // set to false while designing, so pages open without signing in

// "BS Computer Science" -> "BSCS"
function programShort(program){
    const words = (program || '').split(/\s+/).filter(Boolean);
    return words[0] === 'BS' ? 'BS' + words.slice(1).map(w => w[0]).join('').toUpperCase() : (program || '');
}

function initDashboardShell(){
if(sidebar){
    const me = getJSON('ic_session', null);
    if(!me || me.role !== (isStudentPortal ? 'student' : (document.body.dataset.role || 'coordinator'))){
        if(REQUIRE_LOGIN) goTo('login', 'Please sign in first.', 'warn');
    } else if(me.role === 'coordinator' || me.role === 'partnercompany'){
        const parts = (me.name || '').trim().split(/\s+/);
        const initials = ((parts[0] || '')[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
        const values = {
            name: me.name,
            role: me.role === 'partnercompany' ? 'Supervisor · ' + (me.company || 'Industry Partner') : me.program ? programShort(me.program) + ' OJT Coordinator' : '',
            school: me.role === 'partnercompany' ? me.company : me.school,
            classcode: activeClassCode() || me.classCode
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
}}
