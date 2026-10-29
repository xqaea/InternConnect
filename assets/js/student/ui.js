  function initStudentSidebar(){
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('overlay'),mobile=document.getElementById('mobileToggle'),close=document.getElementById('mobileCloseBtn');
    const open=()=>{sidebar?.classList.remove('-translate-x-full');overlay?.classList.remove('hidden');mobile?.classList.add('hidden');};
    const shut=()=>{sidebar?.classList.add('-translate-x-full');overlay?.classList.add('hidden');mobile?.classList.remove('hidden');};
    mobile?.addEventListener('click',open);close?.addEventListener('click',shut);overlay?.addEventListener('click',shut);
    const collapse=document.getElementById('collapseBtn');
    sidebar?.querySelectorAll('.nav-link').forEach(link=>{
      const label=link.querySelector('.sidebar-text')?.textContent.trim();
      if(label){link.setAttribute('title',label);link.setAttribute('aria-label',label);}
    });
    const setCollapsed=collapsed=>{
      sidebar?.classList.toggle('collapsed',collapsed);
      document.getElementById('mainFooter')?.classList.toggle('collapsed',collapsed);
      collapse?.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      collapse?.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
      collapse?.setAttribute('aria-expanded',String(!collapsed));
      localStorage.setItem('sidebarCollapsed',String(collapsed));
    };
    const initiallyCollapsed=localStorage.getItem('sidebarCollapsed')==='true';
    sidebar?.classList.toggle('collapsed',initiallyCollapsed);
    document.getElementById('mainFooter')?.classList.toggle('collapsed',initiallyCollapsed);
    collapse?.setAttribute('aria-label',initiallyCollapsed?'Expand sidebar':'Collapse sidebar');
    collapse?.setAttribute('title',initiallyCollapsed?'Expand sidebar':'Collapse sidebar');
    collapse?.setAttribute('aria-controls','sidebar');
    collapse?.setAttribute('aria-expanded',String(!initiallyCollapsed));
    collapse?.addEventListener('click',()=>setCollapsed(!sidebar?.classList.contains('collapsed')));
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
