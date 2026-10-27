(function(){
  'use strict';

  const REQUIRED_OJT_HOURS = 486; // eligibility check only; no coordinator hour-setting UI is added here.
  const studentPageMap = {
    overview: '../student/overview.html',
    attendance: '../student/attendance.html',
    daylog: '../student/day-log.html',
    classwork: '../student/classwork.html',
    taskdetail: '../student/task-detail.html',
    resume: '../student/resume-builder.html',
    jobs: '../student/job-matching.html',
    login: '../auth/login.html'   // one shared sign in screen for every role
  };

  function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
  }
  function setJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function session(){ return getJSON('ic_session', null); }
  function currentPage(){ return document.body.dataset.page || ''; }
  function show(id){ const el=document.getElementById(id); if(el){ el.classList.remove('hidden'); el.classList.add('flex'); } }
  function hide(id){ const el=document.getElementById(id); if(el){ el.classList.add('hidden'); el.classList.remove('flex'); } }
  function toast(message, type){ if(typeof window.showToast === 'function') window.showToast(message, type || 'info'); }
  function go(page){ if(studentPageMap[page]) window.location.href = studentPageMap[page]; }

  function currentUserRecord(){
    const me = session();
    if(!me || !me.email) return null;
    return getJSON('ic_users', []).find(u => u.role === 'student' && u.email.toLowerCase() === me.email.toLowerCase()) || me;
  }

  function ojtHours(user){
    const value = user && (user.ojtHours ?? user.hours);
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function isAlumni(user){ return !!user && (user.status === 'alumni'); }
  function isPending(user){ return !!user && user.status === 'alumni_pending'; }
  function hasCompletedOJT(user){
    if(!user) return false;
    const placement = placementList(user.classCode || SEED_CODE).find(p =>
      (user.email && p.email === user.email) || p.name === user.name);
    return !!placement && ['Hours complete', 'Completed'].includes(placement.status)
      && placement.hours >= REQUIRED_OJT_HOURS;
  }

  let profileHelpers = null;
  function studentProfileHelpers(){
    if(!profileHelpers) profileHelpers = createStudentProfileHelpers({getJSON, session, currentPage, currentUserRecord, isAlumni, isPending});
    return profileHelpers;
  }
  function applyStudentTheme(){ return studentProfileHelpers().applyStudentTheme(); }
  function personalize(user){ return studentProfileHelpers().personalize(user); }
  function updateActiveNav(user){ return studentProfileHelpers().updateActiveNav(user); }
  function syncToggle(user){ return studentProfileHelpers().syncToggle(user); }

  function refreshStatusFromUser(){
    const rec = currentUserRecord();
    if(!rec) return null;
    const me = session() || {};
    const next = Object.assign({}, me, {
      status: rec.status,
      name: rec.name || me.name,
      program: rec.program || me.program,
      avatar: rec.avatar || me.avatar,
      school: rec.school || me.school,
      theme: rec.theme || me.theme,
      classCode: rec.classCode || me.classCode,
      hours: ojtHours(rec),
      ojtHours: ojtHours(rec)
    });
    setJSON('ic_session', next);
    return rec;
  }

  function enforceAlumniPageAccess(user){
    const restricted = new Set(['attendance','daylog','classwork','taskdetail']);
    if(isAlumni(user) && restricted.has(currentPage())){
      go('overview');
      return true;
    }
    return false;
  }

  let attendanceControls = null;
  function stopAttendanceCamera(){ attendanceControls?.stop(); }
  function exportStudentPdf(filename, title, sections){
    return exportStudentDocumentPdf(filename, title, sections, toast);
  }
  function initResume(){
    initStudentResume({getJSON, setJSON, session, toast, exportStudentPdf});
  }
  function initClasswork(){ initStudentClasswork(studentPageMap); }
  function initTaskDetail(){ initStudentTaskDetail({go, session, toast, exportStudentPdf}); }
  function initJobs(){
    initStudentJobs({currentUserRecord, isAlumni, session, show, hide, toast, getJSON});
  }
  function initAttendanceControls(){
    if(!attendanceControls) attendanceControls = createStudentAttendanceControls({currentUserRecord, isAlumni, session, getJSON, setJSON, show, hide, toast, go});
    attendanceControls.init();
  }
  function registerStudentModules(){
    window.ICCore = window.ICCore || {};
    window.ICCore.resume = window.ICCore.resume || {};
    window.ICCore.resume.init = initResume;
    window.ICCore.student = window.ICCore.student || {};
    window.ICCore.student.initClasswork = initClasswork;
    window.ICCore.student.initTaskDetail = initTaskDetail;
    window.ICCore.student.initJobs = initJobs;
    window.ICCore.student.initAccountControls = initStudentAccountControls;
    window.ICCore.student.initSidebar = initStudentSidebar;
    window.ICCore.student.initNotifications = initStudentNotifications;
    window.ICCore.student.initAttendanceControls = initAttendanceControls;
  }

  function initStudentAccountControls(){
    initStudentAccount({currentUserRecord, isAlumni, isPending, hasCompletedOJT, getJSON, setJSON, session, syncToggle, show, hide, toast, studentPageMap});
  }
  function authorizeStudentSession(){
    const me = session();
    if(!me || me.role !== 'student'){ go('login'); return null; }
    const user = refreshStatusFromUser();
    if(!user){ go('login'); return null; }
    if(user.status === 'pending'){
      localStorage.removeItem('ic_session');
      sessionStorage.setItem('pendingToast', JSON.stringify({message:'Your request to join the class is still waiting for coordinator approval.', type:'warn'}));
      go('login');
      return null;
    }
    return user;
  }

  function hydrateStudentShell(user){
    applyStudentTheme();
    personalize(user);
    if(enforceAlumniPageAccess(user)) return false;
    updateActiveNav(user);
    syncToggle(user);
    return true;
  }

  window.ICCore = window.ICCore || {};
  window.ICCore.student = window.ICCore.student || {};
  window.ICCore.student.authorize = authorizeStudentSession;
  window.ICCore.student.hydrate = hydrateStudentShell;
  window.ICCore.student.registerModules = registerStudentModules;
  window.ICCore.student.session = session;
  window.ICCore.student.navigate = go;
  window.ICCore.student.currentUser = currentUserRecord;
  window.ICCore.student.ui = { show, hide, toast };
  window.ICCore.student.profile = { applyStudentTheme, personalize, updateActiveNav, syncToggle, enforceAlumniPageAccess, refreshStatusFromUser };
  window.addEventListener('beforeunload',stopAttendanceCamera);
})();
