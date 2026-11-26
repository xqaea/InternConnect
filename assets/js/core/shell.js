/* ============ Dashboard Profile (coordinator pages) ============ */

const REQUIRE_LOGIN = true;   // set to false while designing, so pages open without signing in

function renderProfilePictures(){
    const me = getJSON('ic_session', {}) || {};
    document.querySelectorAll('[data-user="avatar"]').forEach(box => {
        const initials = (me.name || '').trim().split(/\s+/).map(word => word[0] || '').slice(0, 2).join('').toUpperCase();
        box.textContent = initials;
        box.style.overflow = 'hidden';
        if(!me.avatar) return;
        const img = document.createElement('img');
        img.alt = 'Profile picture';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;flex-shrink:0';
        img.addEventListener('error', () => box.replaceChildren(document.createTextNode(initials)), {once:true});
        img.src = me.avatar;
        box.replaceChildren(img);
    });
}
document.addEventListener('ic:coordinator-ready', renderProfilePictures);
document.addEventListener('ic:student-ready', renderProfilePictures);

// Placement records carry identity; resolve the picture from the owned student cache.
function profilePictureContent(person){
    const matches = getUsers().filter(user => user.role === 'student' &&
        (person.email ? user.email?.toLowerCase() === person.email.toLowerCase() :
            user.name === person.name && user.classCode === (person.classCode || activeClassCode())));
    const avatar = person.avatar || (matches.length === 1 ? matches[0].avatar : '');
    const initials = (person.name || '?').trim().split(/\s+/).map(word => word[0] || '').slice(0,2).join('').toUpperCase();
    return avatar ? '<img alt="Profile picture" data-profile-initials="'+esc(initials)+'" class="w-full h-full object-cover rounded-full" style="width:100%;height:100%;object-fit:cover" src="'+esc(avatar)+'">' : esc(initials);
}
document.addEventListener('error', event => {
    const img = event.target;
    if(img?.matches?.('img[data-profile-initials]')) img.replaceWith(document.createTextNode(img.dataset.profileInitials));
}, true);

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
        return;
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
            document.querySelectorAll('[data-user="' + key + '"]').forEach(el => el.textContent = values[key] || '');
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
    if(me.role === 'student'){
        ['name','program','school'].forEach(key=>{
            document.querySelectorAll('[data-user="'+key+'"]').forEach(el=>el.textContent=me[key] || '');
        });
        const initials=(me.name || '').trim().split(/\s+/).map(part=>part[0] || '').slice(0,2).join('').toUpperCase();
        document.querySelectorAll('[data-user="avatar"]').forEach(el=>{
            el.textContent=initials;
            if(me.avatar){const img=document.createElement('img');img.src=me.avatar;img.alt='';img.className='w-full h-full object-cover';el.replaceChildren(img);}
        });
    }
    const collapsed=localStorage.getItem('sidebarCollapsed') === 'true';
    sidebar.classList.toggle('collapsed',collapsed);
    mainFooter?.classList.toggle('collapsed',collapsed);
    // Show neutral placeholders while page-specific account/data initialization runs.
    const main = document.querySelector('main');
    if(main && !main.querySelector('.portal-loading-placeholder')){
        const placeholder = document.createElement('div');
        placeholder.className = 'portal-loading-placeholder';
        placeholder.setAttribute('role', 'status');
        placeholder.setAttribute('aria-label', 'Loading page');
        placeholder.innerHTML = '<div class="portal-loading-title"></div><div class="portal-loading-subtitle"></div><div class="portal-loading-cards"><span></span><span></span><span></span></div><div class="portal-loading-panel"><span></span><span></span><span></span><span></span></div>';
        placeholder.querySelectorAll('div, span').forEach(el => el.setAttribute('aria-hidden', 'true'));
        main.prepend(placeholder);
    }
    renderProfilePictures();
    document.documentElement.classList.add('shell-ready');
}}
