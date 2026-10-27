  function initStudentSidebar(){
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),mobile=document.getElementById('mobileToggle'),close=document.getElementById('mobileCloseBtn');
    const open=()=>{sidebar?.classList.remove('-translate-x-full');overlay?.classList.remove('hidden');mobile?.classList.add('hidden');};
    const shut=()=>{sidebar?.classList.add('-translate-x-full');overlay?.classList.add('hidden');mobile?.classList.remove('hidden');};
    mobile?.addEventListener('click',open);close?.addEventListener('click',shut);overlay?.addEventListener('click',shut);
  }

  function initStudentNotifications(){
    document.getElementById('notifBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('notifDropdown')?.classList.toggle('hidden');});
    document.addEventListener('click',e=>{const d=document.getElementById('notifDropdown');if(d && !d.contains(e.target) && e.target.id!=='notifBtn')d.classList.add('hidden');});
  }

/* Compatibility boundary for shared student UI helpers. */
(function () {
  'use strict';
  window.ICCore = window.ICCore || {};
  window.ICCore.student = window.ICCore.student || {};
})();
