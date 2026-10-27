  // ---------------- Classwork / Task Detail ----------------
function initStudentClasswork(studentPageMap){
    document.querySelectorAll('.task-card').forEach(card=>card.addEventListener('click',()=>{
      window.location.href = studentPageMap.taskdetail + '?task=' + encodeURIComponent(card.dataset.task || 'week5');
    }));
  }

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'classwork' && window.ICCore?.student?.initClasswork) window.ICCore.student.initClasswork();
  }, { once: true });
})();
