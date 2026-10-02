const THEMES = ['sky', 'emerald', 'rose'];   // sky = blue (default), emerald = green, rose = red/maroon

function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
}

function applyTheme(theme){
    if(!THEMES.includes(theme)) theme = 'sky';
    document.documentElement.setAttribute('data-theme', theme);
}

// Logged-in user's theme (set at login / sign up, cleared at logout)
const icSession = getJSON('ic_session', null);
applyTheme(icSession && icSession.theme);