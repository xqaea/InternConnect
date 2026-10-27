function createStudentProfileHelpers({getJSON, session, currentPage, currentUserRecord, isAlumni, isPending}){
  function classThemeForUser(user){
    if(!user) return 'sky';
    const classes = getJSON('ic_classes', {});
    const cls = user.classCode ? classes[user.classCode] : null;
    return (cls && cls.theme) || user.theme || 'sky';
  }

  function applyStudentTheme(){
    const user = currentUserRecord();
    if(user && typeof window.applyTheme === 'function'){
      // Theme is inherited from the coordinator's class. No student picker is exposed.
      window.applyTheme(classThemeForUser(user));
    }
  }

  // Fill the name, initials, picture and program from the logged in student
  function personalize(user){
    const me = session() || {};
    const name = (user && user.name) || me.name;
    const program = (user && user.program) || me.program;
    const avatar = (user && user.avatar) || me.avatar;
    const parts = (name || '').trim().split(/\s+/);
    const initials = ((parts[0] || '')[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
    document.querySelectorAll('[data-user="name"]').forEach(el => { if(name) el.textContent = name; });
    document.querySelectorAll('[data-user="program"]').forEach(el => { if(program) el.textContent = program; });
    document.querySelectorAll('[data-user="avatar"]').forEach(el => {
      if(avatar){
        el.innerHTML = '';
        const img = document.createElement('img');
        img.src = avatar; img.alt = ''; img.className = 'w-full h-full object-cover';
        el.appendChild(img);
      } else if(initials){ el.textContent = initials.toUpperCase(); }
    });
  }

  function updateActiveNav(user){
    const page = currentPage();
    document.querySelectorAll('#sidebar .nav-link').forEach(link => link.classList.remove('active'));
    const active = document.querySelector('#sidebar .nav-link[data-tab="' + page + '"]');
    if(active) active.classList.add('active');

    const alumni = isAlumni(user);
    document.querySelectorAll('.student-only-nav').forEach(el => {
      if(alumni) el.classList.add('hidden');
      else el.classList.remove('hidden');
    });

    const jobsLabel = document.getElementById('jobsNavLabel');
    if(jobsLabel) jobsLabel.textContent = alumni ? 'Job Matching' : 'Internship Matching';

    const state = document.getElementById('stateLabel');
    if(state) state.textContent = alumni ? 'Alumni' : (isPending(user) ? 'Student · Alumni Request Pending' : 'Active Student');
  }

  function syncToggle(user){
    const studentBtn = document.getElementById('toggleStudent');
    const alumniBtn = document.getElementById('toggleAlumni');
    const pending = document.getElementById('alumniPendingBadge');
    const wrap = studentBtn && studentBtn.parentElement;

    if(studentBtn) studentBtn.classList.toggle('active', !isAlumni(user));
    if(alumniBtn) alumniBtn.classList.toggle('active', isAlumni(user));

    if(pending){
      pending.classList.toggle('hidden', !isPending(user));
      pending.classList.toggle('flex', isPending(user));
      pending.title = 'Waiting for coordinator approval';
    }

    if(wrap){
      if(isAlumni(user)){
        // Alumni is a final account status; the student toggle cannot switch it back.
        studentBtn?.classList.add('hidden');
        alumniBtn?.classList.remove('hidden');
      } else {
        studentBtn?.classList.remove('hidden');
        alumniBtn?.classList.remove('hidden');
      }
    }
  }
  return {applyStudentTheme, personalize, updateActiveNav, syncToggle};
}

/* Compatibility boundary for student profile, theme, and status helpers. */
(function () {
  'use strict';
  window.ICCore = window.ICCore || {};
  window.ICCore.student = window.ICCore.student || {};
})();
