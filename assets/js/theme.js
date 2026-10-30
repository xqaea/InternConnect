const THEMES = ['sky', 'emerald', 'rose'];   // sky = blue (default), emerald = green, rose = red/maroon

function getJSON(key, fallback){
    if(window.ICCore?.storage) return window.ICCore.storage.getJSON(key, fallback);
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
}

function applyTheme(theme){
    if(!THEMES.includes(theme)) theme = 'sky';
    document.documentElement.setAttribute('data-theme', theme);
}

// Logged-in user's theme (set at login / sign up, cleared at logout)
const icSession = getJSON('ic_session', null);
const icInitialClass = (icSession?.role === 'student' || (icSession?.role === 'partnercompany' && !icSession.databaseAccount)) ? getJSON('ic_classes', {})[icSession.classCode] : null;
applyTheme(icInitialClass?.theme || icSession?.theme);
if(document.documentElement.hasAttribute('data-portal')){
    try{
        document.documentElement.dataset.sidebarCollapsed = String(localStorage.getItem('sidebarCollapsed') === 'true');
    }catch(e){}
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.export-btn').forEach(btn => btn.addEventListener('click', () => {
        const label = btn.textContent.trim();
        if (typeof window.showToast === 'function') window.showToast('Preparing "' + label + '" your download will start shortly.', 'info');
    }));
}, {once: true});
