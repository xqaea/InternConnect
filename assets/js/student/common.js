function initStudentRecords(){
    const me = getJSON('ic_session', {}) || {};
    if(!me.name) return;
    const mine = () => placementList().find(p => p.name === me.name || (me.email && p.email === me.email)) || {name: me.name, status: 'Not placed', history: [], company: ''};
    initStudentInternshipOverview(me, mine, myTasks, mySub, renderNotifs);
    function myTasks(){ return getAllTasks().filter(t => t.classCode === (me.classCode || SEED_CODE) && t.status !== 'archived'); }
    function mySub(id){ return taskInfo(id).submissions.find(x => x.name === me.name) || {}; }
    initStudentTaskRecords(me, mine, myTasks, mySub);
    function renderNotifs(){ renderStudentRecordNotifications(me, mine, myTasks, mySub); }
    renderNotifs();

    initStudentDayLog(mine);
    initStudentAttendanceRecords(me, mine);
}

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const student = window.ICCore?.student;
    if (document.body.dataset.role !== 'student' || !document.getElementById('sidebar')) return;
    const user = student?.authorize?.();
    if (user && student.hydrate?.(user)) {
      student.registerModules?.();
      student.initAccountControls?.();
      student.initSidebar?.();
      student.initNotifications?.();
      student.initAttendanceControls?.();
    }
  }, { once: true });
})();
