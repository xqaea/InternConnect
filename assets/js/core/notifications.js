/* The server owns notification content and read state for database accounts. */
(function(root){
  let items=[],role='',expanded=false,bound=false,unavailable=false;
  const enabled=()=>!!getJSON('ic_session',{})?.databaseAccount;
  const list=()=>document.querySelector('#notifDropdown .divide-y');
  function badge(){
    const unread=items.filter(item=>item.unread).length;
    document.querySelectorAll('#notifBtn .notification-dot,#pNotifDot').forEach(dot=>dot.classList.toggle('hidden',!unread));
    document.getElementById('notifBtn')?.setAttribute('aria-label',unread?'Notifications, '+unread+' unread':'Notifications');
    const waiting=document.getElementById('waitingBadge');
    if(waiting){const count=items.filter(item=>item.unread && item.section==='requests' && (!item.classCode || item.classCode===activeClassCode())).length;waiting.textContent=String(count);waiting.classList.toggle('hidden',!count);waiting.setAttribute('aria-label',count+' unread requests');}
  }
  const rows=entries=>entries.map(item=>'<a href="'+esc(item.href)+'" class="block px-4 py-3 hover:bg-slate-50 '+(item.unread?'bg-sky-50/50':'')+'"><div class="text-[12.5px] font-semibold text-slate-700">'+esc(item.title)+'</div><div class="text-[12px] text-slate-600 mt-0.5">'+esc(item.message)+'</div><div class="text-[10.5px] text-slate-400 mt-1">'+esc(formatDate(item.date))+'</div></a>').join('');
  function render(){
    if(!enabled()) return;
    const box=list();
    if(box){box.classList.add('max-h-80','overflow-y-auto');box.innerHTML=unavailable?'<div class="px-4 py-5 text-center text-[12px] text-slate-400">Notifications are temporarily unavailable.</div>':items.length?rows(expanded?items:items.slice(0,6)):'<div class="px-4 py-5 text-center text-[12px] text-slate-400">No new activity yet.</div>';}
    let all=document.querySelector('[data-all-server-notifications]');
    if(!all && document.getElementById('notifDropdown')){
      const old=[...document.querySelectorAll('#notifDropdown span')].find(span=>span.textContent.trim()==='View all notifications');
      all=document.createElement('button');all.type='button';all.dataset.allServerNotifications='';
      all.className='block w-full px-4 py-2.5 text-center text-[11.5px] text-slate-500 hover:bg-slate-50';
      if(old) old.replaceWith(all);else document.getElementById('notifDropdown').appendChild(all);
      all.addEventListener('click',event=>{event.stopPropagation();expanded=true;render();mark(items.filter(item=>item.unread).map(item=>item.id));});
    }
    if(all){all.textContent='View all notifications';all.hidden=expanded || items.length<=6;}
    if(role==='student'){
      const heading=[...document.querySelectorAll('#tab-overview h2')].find(element=>element.textContent.trim()==='Recent Activity');
      const activity=heading?.closest('.bg-white')?.querySelector('.divide-y');
      if(activity) activity.innerHTML=items.length?rows(items.slice(0,6)):'<div class="px-5 py-4 text-[12px] text-slate-400">No new activity yet.</div>';
    }
    badge();
  }
  async function mark(ids){
    if(!ids.length) return;
    try{await root.ICNotificationApi.read(role,ids);const read=new Set(ids);items.forEach(item=>{if(read.has(item.id))item.unread=false;});render();}
    catch(error){render();showToast('Could not save notification read status. Please try again.', 'warn');}
  }
  async function load(){
    if(!enabled()) return;
    role=getJSON('ic_session',{}).role;
    if(role==='partnercompany')role='partner';
    try{items=(await root.ICNotificationApi.list(role)).notifications;unavailable=false;}
    catch(error){items=[];unavailable=true;render();return;}
    const file=location.pathname.split('/').pop();
    const section={'classwork.html':'classwork','requests.html':'requests','placements.html':'placements','attendance.html':'attendance','day-log.html':'attendance','job-matching.html':'jobs','postings.html':'postings'}[file];
    const task=new URLSearchParams(location.search).get('task');
    const visible=items.filter(item=>item.unread && (role!=='coordinator' || !item.classCode || item.classCode===activeClassCode()) && (section?item.section===section:file==='task-detail.html' && task && new URL(item.href,location.href).searchParams.get('task')===task));
    if(visible.length) await mark(visible.map(item=>item.id));
    if(!bound){
      bound=true;
      document.getElementById('notifBtn')?.addEventListener('click',()=>queueMicrotask(()=>{
        render();
        if(!document.getElementById('notifDropdown')?.classList.contains('hidden'))mark((expanded?items:items.slice(0,6)).filter(item=>item.unread).map(item=>item.id));
      }));
    }
    render();
  }
  root.ICNotifications={load,render,badge};
})(window);
