function initStudentRecords(){
    const me = getJSON('ic_session', {}) || {};
    if(!me.name) return;
    const mine = () => placementList().find(p => p.name === me.name || (me.email && p.email === me.email)) || {name: me.name, status: 'Not placed', history: [], company: ''};
    initStudentInternshipOverview(me, mine, myTasks, mySub, renderNotifs);
    function myTasks(){ return getAllTasks().filter(t => t.classCode === (me.classCode || SEED_CODE) && t.status !== 'archived'); }
    function mySub(id){ return taskInfo(id).submissions.find(x => x.databaseReport?x.email===me.email:x.name===me.name) || {}; }
    initStudentTaskRecords(me, mine, myTasks, mySub);
    function renderNotifs(){ renderStudentRecordNotifications(me, mine, myTasks, mySub); }
    renderNotifs();

    initStudentDayLog(mine);
    initStudentAttendanceRecords(me, mine);
}

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const student = window.ICCore?.student;
    if (document.body.dataset.role !== 'student' || !document.getElementById('sidebar')) return;
    const saved = getJSON('ic_session', null);
    if(saved?.databaseAccount){
      try{
        if(!sessionStorage.getItem('ic_student_token')) throw {status: 401};
        const result = await window.ICStudentApi.me();
        const applications = await window.ICStudentApi.applications();
        cacheDatabasePlacements((await window.ICStudentApi.placements()).placements);
        cacheDatabaseAttendance((await window.ICStudentApi.attendance()).attendance);
        cacheDatabaseTasks((await window.ICStudentApi.tasks()).tasks);
        cacheDatabaseReports((await window.ICStudentApi.reports()).reports);
        cacheDatabaseApplications(applications.applications);
        const resumes = getJSON('ic_resume', {});
        const resumeKey = result.user.email.toLowerCase();
        // Database records are authoritative; local drafts are imported only by an explicit save.
        if(result.resume) resumes[resumeKey] = result.resume;
        localStorage.setItem('ic_resume', JSON.stringify(resumes));
        const users = getUsers();
        const record = users.find(u => u.role === 'student' && u.email.toLowerCase() === result.user.email.toLowerCase()) || {};
        const cached = Object.assign({}, record, result.user);
        if(result.user.status === 'active' && ['intern', 'alumni', 'alumni_pending'].includes(record.status)) cached.status = record.status;
        delete cached.password;
        localStorage.setItem('ic_session', JSON.stringify(Object.assign({}, saved, cached)));
        saveUsers(users.filter(u => !(u.role === 'student' && u.email.toLowerCase() === result.user.email.toLowerCase())).concat(cached));
      }catch(error){
        if(error.status === 401 || error.status === 403){
          sessionStorage.removeItem('ic_student_token');
          localStorage.removeItem('ic_session');
        }
        sessionStorage.setItem('pendingToast', JSON.stringify({message: error.status === 401 ? 'Your session expired. Please sign in again.' : error.message || 'Unable to verify your student account. Please sign in again.', type: 'warn'}));
        window.location.href = '../auth/login.html';
        return;
      }
    }
    const user = student?.authorize?.();
    if (user && student.hydrate?.(user)) {
      student.registerModules?.();
      student.initAccountControls?.();
      student.initSidebar?.();
      student.initNotifications?.();
      student.initAttendanceControls?.();
      document.dispatchEvent(new Event('ic:student-ready'));
      document.documentElement.classList.add('app-ready');
    }
  }, { once: true });
})();
