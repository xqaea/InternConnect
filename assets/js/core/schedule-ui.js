function openScheduleModal(p, title, onSave){
    let m = document.getElementById('scheduleModal');
    const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="scheduleModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 id="schedTitle" class="font-bold text-slate-900"></h3><button data-sched="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p class="text-[12px] text-slate-500 mb-4">Copy the schedule from the acceptance letter or from the company. Late is counted from this schedule.</p>'
          + '<div class="text-[12.5px] font-medium text-slate-600 mb-1">Work days</div><div class="flex flex-wrap gap-1.5 mb-3">'
          + [1, 2, 3, 4, 5, 6, 0].map(d => '<label class="text-[12px] text-slate-700 border border-slate-200 rounded-md px-2 py-1 cursor-pointer has-[:checked]:bg-sky-50 has-[:checked]:border-sky-300"><input type="checkbox" class="sched-day mr-1 accent-sky-600" value="' + d + '">' + DAY_NAMES[d] + '</label>').join('') + '</div>'
          + '<div class="grid grid-cols-2 gap-3 mb-3"><div><label for="schedIn" class="text-[12.5px] font-medium text-slate-600 block mb-1">Time in</label><input id="schedIn" type="time" class="' + field + '"></div>'
          + '<div><label for="schedOut" class="text-[12.5px] font-medium text-slate-600 block mb-1">Time out</label><input id="schedOut" type="time" class="' + field + '"></div>'
          + '<div><label for="schedGrace" class="text-[12.5px] font-medium text-slate-600 block mb-1">Grace period (mins)</label><input id="schedGrace" type="number" min="0" max="60" class="' + field + '"></div>'
          + '<div><label for="schedMode" class="text-[12.5px] font-medium text-slate-600 block mb-1">Work setup</label><select id="schedMode" class="' + field + '"><option>On-site</option><option>Hybrid</option><option>Remote</option></select></div></div>'
          + '<label class="flex items-center gap-2 text-[12.5px] text-slate-700 mt-1"><input id="schedOwnSite" type="checkbox" class="accent-sky-600"> Intern reports to a different branch</label>'
          + '<div id="schedSiteBox" class="hidden mt-2 grid grid-cols-[1fr_96px] gap-2"><input id="schedSitePlace" placeholder="Branch name" class="' + field + '"><select id="schedSiteRadius" class="' + field + '">' + RADIUS_OPTIONS.map(r => '<option value="' + r + '">' + r + ' m</option>').join('') + '</select>'
          + '<input id="schedSiteCoords" placeholder="Google Maps link or lat, lng" class="' + field + ' col-span-2"></div>'
          + '<div class="flex justify-end gap-2.5 mt-5"><button data-sched="close" class="text-[12.5px] font-medium text-slate-500 hover:text-slate-700 px-3.5 py-2">Cancel</button>'
          + '<button data-sched="save" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-md transition">Save</button></div></div></div>');
        m = document.getElementById('scheduleModal');
        m.addEventListener('change', (e) => { if(e.target.id === 'schedOwnSite') document.getElementById('schedSiteBox').classList.toggle('hidden', !e.target.checked); });
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sched]');
            if(!b) return;
            if(b.dataset.sched === 'close'){ closeModal(m); return; }
            if(b.dataset.sched !== 'save') return;
            const sched = {days: [...m.querySelectorAll('.sched-day:checked')].map(c => Number(c.value)).sort(),
                timeIn: document.getElementById('schedIn').value, timeOut: document.getElementById('schedOut').value,
                grace: Math.max(0, Number(document.getElementById('schedGrace').value) || 0), mode: document.getElementById('schedMode').value, site: null};
            if(document.getElementById('schedOwnSite').checked){
                const c = parseCoords(document.getElementById('schedSiteCoords').value), place = document.getElementById('schedSitePlace').value.trim();
                if(!c || !place){ showToast('Add the branch name and its location (Google Maps link or lat, lng).', 'warn'); return; }
                sched.site = {lat: c.lat, lng: c.lng, place, radius: Number(document.getElementById('schedSiteRadius').value)};
            }
            if(!sched.days.length){ showToast('Pick at least one work day.', 'warn'); return; }
            if(!sched.timeIn || !sched.timeOut || clockMins(sched.timeOut) <= clockMins(sched.timeIn)){ showToast('Time out must be later than time in.', 'warn'); return; }
            closeModal(m);
            m._onSave(sched);
        });
    }
    const sc = scheduleOf(p);
    document.getElementById('schedTitle').textContent = title;
    m.querySelectorAll('.sched-day').forEach(c => { c.checked = sc.days.includes(Number(c.value)); });
    const own = sc.site, base = companySite(p.company);
    document.getElementById('schedOwnSite').checked = !!own;
    document.getElementById('schedSiteBox').classList.toggle('hidden', !own);
    document.getElementById('schedSitePlace').value = own ? own.place : '';
    document.getElementById('schedSiteCoords').value = own ? own.lat + ', ' + own.lng : '';
    document.getElementById('schedSiteRadius').value = String(own ? own.radius : base.radius);
    document.getElementById('schedIn').value = sc.timeIn;
    document.getElementById('schedOut').value = sc.timeOut;
    document.getElementById('schedGrace').value = sc.grace;
    document.getElementById('schedMode').value = sc.mode;
    m._onSave = onSave;
    openModal(m);
}
