// Prototype accounts are local; shared partner accounts are also limited by MySQL.
(function(root){
    const key = 'ic_login_attempts';
    const duration = 5 * 60 * 1000;
    let fallback = {};
    const accountKey = (role, email) => role + ':' + email.trim().toLowerCase();
    function read(){
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch(e) { return fallback; }
    }
    function write(records){
        fallback = records;
        try { localStorage.setItem(key, JSON.stringify(records)); } catch(e) {}
    }
    function status(role, email){
        const records = read(), id = accountKey(role, email);
        let state = records[id] || {failures: 0, blockedUntil: 0};
        if(state.blockedUntil && state.blockedUntil <= Date.now()){
            delete records[id]; write(records);
            state = {failures: 0, blockedUntil: 0};
        }
        return {...state, seconds: Math.max(0, Math.ceil((state.blockedUntil - Date.now()) / 1000))};
    }
    function fail(role, email){
        const state = status(role, email);
        if(state.seconds) return state;
        const records = read();
        const failures = Math.min(5, state.failures + 1);
        records[accountKey(role, email)] = {failures, blockedUntil: failures === 5 ? Date.now() + duration : 0};
        write(records);
        return status(role, email);
    }
    function block(role, email, seconds){
        const records = read();
        records[accountKey(role, email)] = {failures: 5, blockedUntil: Date.now() + seconds * 1000};
        write(records);
    }
    function reset(role, email){
        const records = read(); delete records[accountKey(role, email)]; write(records);
    }
    root.ICLoginLockout = {status, fail, block, reset};
})(window);
