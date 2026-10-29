// Hydrate existing coordinator screens from records owned by the authenticated account.
window.syncCoordinatorState = async function(){
    const result = await window.ICCoordinatorApi.state();
    const partnerResult = await window.ICCoordinatorApi.partners();
    const applicationResult = await window.ICCoordinatorApi.applications();
    cacheDatabasePlacements((await window.ICCoordinatorApi.placements()).placements);
    cacheDatabaseAttendance((await window.ICCoordinatorApi.attendance()).attendance);
    cacheDatabaseTasks((await window.ICCoordinatorApi.tasks()).tasks);
    cacheDatabaseReports((await window.ICCoordinatorApi.reports()).reports);
    cacheDatabaseApplications(applicationResult.applications);
    const oldSession = getJSON('ic_session', {}) || {};
    const classes = getJSON('ic_classes', {});
    Object.keys(classes).forEach(code => {
        if(classes[code].databaseBatch && classes[code].coordinator === result.user.email) delete classes[code];
    });
    result.batches.forEach(batch => { classes[batch.code] = {...batch, databaseBatch: true}; });
    localStorage.setItem('ic_classes', JSON.stringify(classes));
    const codes = new Set(result.batches.map(batch => batch.code));
    const users = getUsers();
    const students = result.students.map(student => {
        const old = users.find(u => u.role === 'student' && u.email.toLowerCase() === student.email.toLowerCase()) || {};
        const record = {...old, ...student};
        if(student.status === 'active' && ['intern', 'alumni', 'alumni_pending'].includes(old.status)) record.status = old.status;
        delete record.password;
        return record;
    });
    const incoming = new Set(students.map(student => student.email.toLowerCase()));
    const partners = partnerResult.partners;
    const partnerEmails = new Set(partners.map(partner => partner.email.toLowerCase()));
    saveUsers(users.filter(u => !(u.role === 'student' && ((u.databaseAccount && codes.has(u.classCode)) || incoming.has(u.email.toLowerCase()))))
        .filter(u => !(u.role === 'partnercompany' && ((u.databaseAccount && codes.has(u.classCode)) || partnerEmails.has(u.email.toLowerCase()))))
        .concat(students, partners));
    localStorage.setItem('ic_session', JSON.stringify({...oldSession, ...result.user}));
    if(!codes.has(localStorage.getItem('ic_active_class')) && result.batches.length) setActiveClass(result.batches[0].code);
    refreshHeaderCode();
    return result;
};
