function initStudentAccount({currentUserRecord, isAlumni, isPending, hasCompletedOJT, getJSON, setJSON, session, syncToggle, show, hide, toast, studentPageMap}){
  function findRequest(email){
    return getJSON('ic_alumni_requests', []).find(r => r.email === email && r.status === 'pending') || null;
  }

  function openAlumniModal(){ show('alumniRequestModal'); }
  function closeAlumniModal(){ hide('alumniRequestModal'); }

  function requestAlumniStatus(){
    const user = currentUserRecord();
    if(!user) return toast('Please sign in first.', 'warn');
    if(isAlumni(user)) return;
    if(isPending(user)) return toast('Your Alumni status request is already pending.', 'info');

    // No OJT-hour setting is added here. This only checks whatever hours the coordinator/backend has already saved.
    if(!hasCompletedOJT(user)){
      return toast('You can request Alumni Status after completing your OJT hours.', 'warn');
    }
    openAlumniModal();
  }

  function sendAlumniRequest(){
    const user = currentUserRecord();
    if(!user) return;
    if(!hasCompletedOJT(user)){
      closeAlumniModal();
      return toast('You can request Alumni Status after completing your OJT hours.', 'warn');
    }

    const requests = getJSON('ic_alumni_requests', []);
    if(findRequest(user.email)){
      closeAlumniModal();
      return toast('Your Alumni status request is already pending.', 'info');
    }

    requests.push({
      email: user.email,
      studentName: user.name || 'Student',
      program: user.program || '',
      classCode: user.classCode || '',
      coordinatorEmail: (() => {
        const classes = getJSON('ic_classes', {});
        return user.classCode && classes[user.classCode] ? (classes[user.classCode].coordinator || '') : '';
      })(),
      requestedAt: new Date().toISOString(),
      status: 'pending'
    });
    setJSON('ic_alumni_requests', requests);

    // Keep the canonical user record pending; do not change privileges yet.
    const users = getJSON('ic_users', []);
    const idx = users.findIndex(u => u.role === 'student' && u.email.toLowerCase() === user.email.toLowerCase());
    if(idx >= 0){
      users[idx] = Object.assign({}, users[idx], {status:'alumni_pending', alumniRequestedAt:new Date().toISOString()});
      setJSON('ic_users', users);
    }

    const me = session() || {};
    setJSON('ic_session', Object.assign({}, me, {status:'alumni_pending'}));
    syncToggle(Object.assign({}, user, {status:'alumni_pending'}));
    closeAlumniModal();
    toast('Alumni status request sent to your OJT coordinator.', 'success');
  }

  function initStudentAccountControls(){
    document.getElementById('toggleStudent')?.addEventListener('click',()=>{
      const u=currentUserRecord(); if(!u)return;
      if(isAlumni(u)) return toast('Your account is already in Alumni Status.','info');
      if(isPending(u)) return toast('Your Alumni status request is still pending.','info');
      toast('You are currently in Student mode.','info');
    });
    document.getElementById('toggleAlumni')?.addEventListener('click',requestAlumniStatus);
    document.getElementById('alumniPendingBadge')?.addEventListener('click',()=>toast('Your Alumni status request is waiting for coordinator approval.','info'));
    document.getElementById('cancelAlumniRequestBtn')?.addEventListener('click',closeAlumniModal);
    document.getElementById('sendAlumniRequestBtn')?.addEventListener('click',sendAlumniRequest);
    document.getElementById('logoutBtn')?.addEventListener('click',async ()=>{
      if(!await askConfirm('Log out of InternConnect?')) return;
      if(session()?.databaseAccount){ try { await window.ICStudentApi.logout(); } catch(e) {} }
      sessionStorage.removeItem('ic_student_token');
      localStorage.removeItem('ic_session');
      sessionStorage.setItem('pendingToast',JSON.stringify({message:'You have been logged out.',type:'info'}));
      window.location.href=studentPageMap.login;
    });
  }
  initStudentAccountControls();
}
