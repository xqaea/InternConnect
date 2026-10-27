function createStudentAttendanceControls({currentUserRecord, isAlumni, session, getJSON, setJSON, show, hide, toast, go}){
  // ---------------- Attendance ----------------
  let attendanceStream = null;
  let attendancePhoto = '';
  let attendancePosition = null;
  let timeInMoment = null;
  let attendanceAction = 'in';

  function stopAttendanceCamera(){
    if(attendanceStream){
      attendanceStream.getTracks().forEach(t => t.stop());
      attendanceStream = null;
    }
  }

  function startAttendanceCamera(){
    const video = document.getElementById('attendanceCamera');
    const cameraModal = document.getElementById('attendanceCameraModal');
    if(!video || !cameraModal) return;

    show('attendanceCameraModal');
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'user'}, audio:false})
      .then(stream => {
        attendanceStream = stream;
        video.srcObject = stream;
      })
      .catch(() => {
        stopAttendanceCamera();
        hide('attendanceCameraModal');
        toast('Camera access was not granted. Please allow camera access and try again.', 'warn');
      });
  }

  function requestLocation(){
    return new Promise(resolve => {
      if(!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => { attendancePosition = pos.coords; resolve(pos.coords); },
        () => resolve(null),
        {enableHighAccuracy:true, timeout:10000, maximumAge:0}
      );
    });
  }

  async function beginTimeIn(){
    const user = currentUserRecord();
    if(!user || isAlumni(user)) return toast('Time In is only available while you are an active OJT student.', 'warn');
    const pl = placementList().find(x => x.name === user.name);
    if(!pl || !['Deployed', 'Hours complete'].includes(pl.status)) return toast('Time In opens after your coordinator confirms your deployment.', 'warn');
    if((liveRecs(user.name)[todayISO()] || {}).in != null) return toast('You already timed in today.', 'info');

    attendanceAction = 'in';
    attendancePhoto = '';
    attendancePosition = null;
    show('attendancePermissionModal');
  }

  async function allowAttendance(){
    hide('attendancePermissionModal');
    const locPromise = requestLocation();
    startAttendanceCamera();
    await locPromise;
    if(!attendancePosition) toast('Location permission was not available. The attendance can continue only if the location can be verified.', 'warn');
  }

  function captureAttendancePhoto(){
    const video = document.getElementById('attendanceCamera');
    const canvas = document.getElementById('attendanceCanvas');
    const previewWrap = document.getElementById('timeInPhotoPreview');
    const img = document.getElementById('timeInPhoto');
    if(!video || !canvas || !video.videoWidth) return toast('Camera is not ready yet. Please wait a moment.', 'warn');
    const scale = Math.min(1, 480 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    attendancePhoto = canvas.toDataURL('image/jpeg', 0.55);
    if(img){ img.src = attendancePhoto; }
    if(previewWrap){ previewWrap.classList.remove('hidden'); previewWrap.classList.add('flex'); }
    document.getElementById('captureAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('captureAttendancePhotoBtn')?.classList.remove('flex');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.add('flex');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.add('flex');
  }

  function retakeAttendancePhoto(){
    attendancePhoto = '';
    document.getElementById('captureAttendancePhotoBtn')?.classList.remove('hidden');
    document.getElementById('captureAttendancePhotoBtn')?.classList.add('flex');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('retakeAttendancePhotoBtn')?.classList.remove('flex');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.add('hidden');
    document.getElementById('confirmAttendancePhotoBtn')?.classList.remove('flex');
  }

  function confirmTimeIn(){
    if(!attendancePhoto) return toast('Capture an attendance photo first.', 'warn');
    if(!attendancePosition) return toast('Your location could not be verified. Allow location access and try again.', 'warn');
    if(attendanceAction === 'out'){
      const me = session() || {};
      const today = liveRecs(me.name)[todayISO()] || {};
      if(today.in == null || today.out != null) return toast('There is no open Time In for today.', 'warn');
      const timeOutMoment = new Date();
      const hrs = saveLiveClock(me.name, 'out', attendancePhoto, attendancePosition);
      stopAttendanceCamera();
      hide('attendanceCameraModal');
      hide('timeInConfirmation');
      show('timeOutConfirmation');
      const stamp = document.getElementById('timeOutStamp');
      if(stamp) stamp.textContent = timeOutMoment.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      const total = document.getElementById('hoursTotal');
      if(total) total.textContent = hrs;
      toast('Time Out recorded with your attendance photo and location.', 'success');
      return;
    }
    timeInMoment = new Date();
    saveLiveClock(getJSON('ic_session', {}).name, 'in', attendancePhoto, attendancePosition);
    stopAttendanceCamera();
    hide('attendanceCameraModal');
    hide('timeInPrompt');
    const confirmation = document.getElementById('timeInConfirmation');
    if(confirmation){ confirmation.classList.remove('hidden'); confirmation.classList.add('flex'); }
    const stamp = document.getElementById('timeInStamp');
    if(stamp) stamp.textContent = timeInMoment.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    const stored = getJSON('ic_attendance', []);
    stored.unshift({date:new Date().toISOString(), timeIn:timeInMoment.toISOString(), photo:attendancePhoto, gps: attendancePosition ? {lat:attendancePosition.latitude, lng:attendancePosition.longitude} : null});
    setJSON('ic_attendance', stored.slice(0,100));
    toast('Time In recorded with your attendance photo and location.', 'success');
  }

  function timeOut(){
    const me = getJSON('ic_session', {}), today = liveRecs(me.name)[todayISO()] || {};
    if(today.in == null) return toast('Please Time In first.', 'warn');
    if(today.out != null) return toast('You already timed out today.', 'info');
    attendanceAction = 'out';
    attendancePhoto = '';
    attendancePosition = null;
    const confirm = document.getElementById('confirmAttendancePhotoBtn');
    if(confirm) confirm.textContent = 'Confirm Time Out';
    const message = document.querySelector('#attendancePermissionModal p');
    if(message) message.textContent = 'To record Time Out, InternConnect needs a live attendance photo and your current location. Your browser may show permission prompts next.';
    retakeAttendancePhoto();
    show('attendancePermissionModal');
  }

  function initAttendanceControls(){
    document.getElementById('timeInBtn')?.addEventListener('click',beginTimeIn);
    document.getElementById('cancelAttendancePermissionBtn')?.addEventListener('click',()=>hide('attendancePermissionModal'));
    document.getElementById('allowAttendancePermissionBtn')?.addEventListener('click',allowAttendance);
    document.getElementById('cancelAttendanceCameraBtn')?.addEventListener('click',()=>{stopAttendanceCamera();hide('attendanceCameraModal');});
    document.getElementById('captureAttendancePhotoBtn')?.addEventListener('click',captureAttendancePhoto);
    document.getElementById('retakeAttendancePhotoBtn')?.addEventListener('click',retakeAttendancePhoto);
    document.getElementById('confirmAttendancePhotoBtn')?.addEventListener('click',confirmTimeIn);
    document.getElementById('timeOutBtn')?.addEventListener('click',timeOut);
    document.getElementById('backToAttendanceBtn')?.addEventListener('click',()=>go('attendance'));
  }
  return {init: initAttendanceControls, stop: stopAttendanceCamera};
}

function initStudentAttendanceRecords(me, mine){
    // ---- Today's time in / out state ----
    window.renderTodayClock = () => {
        const today = liveRecs(me.name)[todayISO()], p = mine();
        if(!today || !document.getElementById('timeInPrompt')) return;
        const showFlex = (id, yes) => { const el = document.getElementById(id); if(el){ el.classList.toggle('hidden', !yes); el.classList.toggle('flex', yes); } };
        showFlex('timeInPrompt', false);
        showFlex('timeInConfirmation', today.out == null);
        showFlex('timeOutConfirmation', today.out != null);
        const where = document.getElementById('timeInStamp')?.parentElement;
        if(where) where.innerHTML = '📍 ' + esc(siteFor(p).place) + (today.dist != null ? ' · ' + today.dist + ' m from site' : '') + ' · <span id="timeInStamp">' + fmtClock(today.in) + '</span>';
        if(today.photoIn){ const img = document.getElementById('timeInPhoto'); if(img) img.src = today.photoIn; showFlex('timeInPhotoPreview', true); }
        if(today.out != null){ set2('timeOutStamp', fmtClock(today.out)); set2('hoursTotal', today.hours); }
    };
    const set2 = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    window.renderTodayClock();

    // ---- Attendance: same records the coordinator sees ----
    window.renderStudentAttendance = () => {
    window.renderTodayClock();
    const body = document.getElementById('attendanceSummaryBody');
    if(body){
        const p = mine();
        const recs = ['Deployed', 'Hours complete', 'Completed'].includes(p.status) ? internAttendance(p) : [];
        const cal = document.getElementById('attendanceCalendar');
        if(!recs.length){
            body.innerHTML = '<tr><td colspan="7" class="px-5 py-6 text-center text-[12.5px] text-slate-400">' + (['Deployed', 'Hours complete'].includes(p.status) ? 'No clock-ins yet.' : 'Attendance starts after your coordinator confirms your deployment.') + '</td></tr>';
            document.getElementById('attendanceStats').innerHTML = '';
            if(cal) cal.innerHTML = '';
            return;
        }
        const n = (st) => recs.filter(r => r.status === st).length;
        const chip = (txt, tone) => '<span class="px-2.5 py-1 rounded-full border font-semibold ' + tone + '">' + txt + '</span>';
        document.getElementById('attendanceStats').innerHTML = chip(recs.filter(r => !['Absent', 'Holiday'].includes(r.status)).length + ' present', 'bg-emerald-50 text-emerald-700 border-emerald-200')
            + chip(n('Late') + ' late', 'bg-amber-50 text-amber-700 border-amber-200') + chip(n('Absent') + ' absent', 'bg-red-50 text-red-600 border-red-200')
            + (n('Flagged') ? chip(n('Flagged') + ' flagged', 'bg-red-50 text-red-600 border-red-200') : '') + chip((p.hours || 0) + ' / ' + REQUIRED_HOURS + ' hrs', 'bg-slate-100 text-slate-600 border-slate-200');
        body.innerHTML = recs.map(r => {
            const off = r.status === 'Absent' || r.status === 'Holiday';
            return '<tr class="cursor-pointer hover:bg-slate-50" data-date="' + r.date + '"><td class="px-5 py-3 text-slate-700 whitespace-nowrap">' + formatDate(r.date) + '</td>'
                + '<td class="px-5 py-3">' + (off ? '<span class="text-slate-300">—</span>' : '<img src="' + clockPhoto(p, r, 'in') + '" alt="Clock-in photo" class="w-7 h-9 rounded object-cover border border-slate-200">') + '</td>'
                + '<td class="px-5 py-3 whitespace-nowrap text-slate-600">' + (off ? '—' : fmtClock(r.timeIn)) + '</td><td class="px-5 py-3 whitespace-nowrap text-slate-600">' + (off ? '—' : fmtClock(r.timeOut)) + '</td>'
                + '<td class="px-5 py-3 text-[11.5px] text-slate-500">' + (r.status === 'Holiday' ? esc(r.place) : off ? '—' : esc(r.place) + (r.dist != null ? '<div class="text-[10.5px] ' + (r.dist > (r.radius || GEOFENCE_M) ? 'text-red-500' : 'text-slate-400') + '">' + r.dist + ' m from site</div>' : '')) + '</td>'
                + '<td class="px-5 py-3 font-medium whitespace-nowrap ' + (r.review === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-700') + '">' + (r.status === 'Holiday' ? '—' : r.hours + ' hrs') + '</td>'
                + '<td class="px-5 py-3"><span class="text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + ATT_BADGE[r.status] + '">' + r.status + (r.review ? ' · ' + r.review : '') + '</span></td></tr>';
        }).join('');
        body.onclick = (e) => { const tr = e.target.closest('tr[data-date]'); if(tr) location.href = '../student/day-log.html?date=' + tr.dataset.date; };
        if(cal){
            const last = new Date(recs[0].date + 'T00:00:00'), y = last.getFullYear(), mo = last.getMonth();
            const head = cal.parentElement.querySelector('h2');
            if(head) head.textContent = last.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});
            const byDate = Object.fromEntries(recs.map(r => [r.date, r]));
            let html = '';
            for(let i = 0; i < new Date(y, mo, 1).getDay(); i++) html += '<div class="cal-day empty"></div>';
            for(let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++){
                const r = byDate[isoDate(new Date(y, mo, d))], wd = new Date(y, mo, d).getDay();
                const cls = !r ? (wd === 0 || wd === 6 ? ' weekend' : '') : r.status === 'Absent' ? ' absent' : r.status === 'Holiday' ? ' weekend' : ' present';
                html += '<div class="cal-day' + cls + (r ? ' cursor-pointer' : '') + '"' + (r ? ' data-date="' + r.date + '"' : '') + ' title="' + (r ? r.status + (r.timeIn ? ' · ' + fmtClock(r.timeIn) + ' – ' + fmtClock(r.timeOut) : r.place ? ' · ' + esc(r.place) : '') : '') + '">' + d + (r ? '<span class="cal-dot"></span>' : '') + '</div>';
            }
            cal.innerHTML = html;
            cal.onclick = (e) => { const c = e.target.closest('[data-date]'); if(c) location.href = '../student/day-log.html?date=' + c.dataset.date; };
        }
    }
    };
    window.renderStudentAttendance();
}

// Saves a time in / time out from the student portal; returns the hours of the day
function saveLiveClock(name, kind, photo, coords){
    const p = placementList().find(x => x.name === name) || {};
    const site = siteFor(p);
    const now = new Date(), date = isoDate(now), mins = now.getHours() * 60 + now.getMinutes();
    const all = getJSON(LIVE_KEY, {}), mine = all[name] || {}, rec = mine[date] || {};
    const rad = (x) => x * Math.PI / 180;
    const dist = coords ? Math.round(2 * 6371000 * Math.asin(Math.sqrt(Math.sin(rad(coords.latitude - site.lat) / 2) ** 2 + Math.cos(rad(site.lat)) * Math.cos(rad(coords.latitude)) * Math.sin(rad(coords.longitude - site.lng) / 2) ** 2))) : null;
    if(kind === 'in') Object.assign(rec, {in: mins, photoIn: photo, lat: coords ? coords.latitude.toFixed(5) : '', lng: coords ? coords.longitude.toFixed(5) : '', dist});
    else {
        if(rec.in == null || rec.out != null || !coords || !photo) return 0;
        const span = mins - rec.in;
        Object.assign(rec, {out: mins, hours: Math.max(0, Math.round((span - (span > 300 ? 60 : 0)) / 6) / 10),
            photoOut: photo, latOut: coords.latitude.toFixed(5), lngOut: coords.longitude.toFixed(5), distOut: dist});
    }
    mine[date] = rec; all[name] = mine;
    localStorage.setItem(LIVE_KEY, JSON.stringify(all));
    window.renderStudentAttendance?.();
    return rec.hours || 0;
}
