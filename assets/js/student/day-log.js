function initStudentDayLog(mine){
    // ---- Day log (?date=YYYY-MM-DD) ----
    if(document.getElementById('dayLogDate')){
        const p = mine(), date = new URLSearchParams(location.search).get('date') || todayISO();
        const r = internAttendance(p).find(x => x.date === date);
        const set = (id, v) => { const el = document.getElementById(id); if(el) el.innerHTML = v; };
        set('dayLogDate', new Date(date + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}));
        const box = document.querySelector('#tab-daylog .h-40'), loc = document.querySelector('#tab-daylog .space-y-2 > div:nth-child(4) span:last-child');
        const off = !r || r.status === 'Absent' || r.status === 'Holiday';
        if(box && !off) box.innerHTML = '<img src="' + clockPhoto(p, r, 'in') + '" alt="Time in photo" class="h-full rounded-md">';
        set('dlIn', off ? '—' : fmtClock(r.timeIn));
        set('dlOut', off ? '—' : fmtClock(r.timeOut));
        set('dlHours', !r || r.status === 'Holiday' ? '—' : r.hours + ' hrs' + (r.review === 'rejected' ? ' (not counted)' : ''));
        if(loc) loc.innerHTML = !r ? '—' : r.status === 'Holiday' ? esc(r.place) : off ? '—' : '<i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>' + esc(r.place) + (r.dist != null ? ' · ' + r.dist + ' m from site' : '') + (r.lat ? '<div class="text-[11px] text-slate-400 text-right">' + r.lat + ', ' + r.lng + '</div>' : '');
        const dl = document.getElementById('dlStatus');
        if(dl){ dl.textContent = r ? r.status + (r.review ? ' · ' + r.review : '') : 'No record'; dl.className = 'text-[11px] font-semibold border px-2 py-0.5 rounded-full ' + (r ? ATT_BADGE[r.status] : 'text-slate-500 bg-slate-50 border-slate-200'); }
        renderDayExplain(p, r);
    }

    // ---- Explain a flagged, late or absent day ----
    function renderDayExplain(p, r){
        const card = document.querySelector('#tab-daylog .max-w-lg');
        document.getElementById('dayExplain')?.remove();
        if(!card || !r || !['Flagged', 'Absent', 'Late'].includes(r.status)) return;
        const box = '<div id="dayExplain" class="mt-4 pt-4 border-t border-slate-100">';
        const DONE = {accepted: ['text-emerald-700', 'Your coordinator accepted this clock-in.'], rejected: ['text-red-600', 'Your coordinator rejected this clock-in. Its hours are not counted.'],
            excused: ['text-emerald-700', 'Your coordinator excused this absence.'], unexcused: ['text-slate-600', 'Your coordinator kept this day as absent.']};
        const quote = r.note ? '<div class="text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2"><strong>' + esc(r.note.type) + ':</strong> ' + esc(r.note.reason) + '<div class="text-[10.5px] text-slate-400 mt-1">Sent ' + formatDate(r.note.at) + '</div></div>' : '';
        if(r.review && DONE[r.review]){
            card.insertAdjacentHTML('beforeend', box + '<div class="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Your explanation</div>' + (quote || '<div class="text-[12px] text-slate-400">You did not send an explanation.</div>')
                + '<div class="text-[12px] font-semibold mt-2 ' + DONE[r.review][0] + '">' + DONE[r.review][1] + '</div></div>');
            return;
        }
        const why = {Flagged: 'Your clock-in was outside the ' + (r.radius || GEOFENCE_M) + ' m geofence.', Absent: 'There is no clock-in for this scheduled day.', Late: 'You clocked in after your grace period.'}[r.status];
        const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-sky-400';
        card.insertAdjacentHTML('beforeend', box
            + '<div class="text-[13px] font-semibold text-slate-800">' + (r.note ? 'Your explanation' : 'Explain this day') + '</div>'
            + '<div class="text-[11.5px] text-slate-500 mb-2">' + why + ' Your coordinator sees this before reviewing it.</div>'
            + (r.note ? '<div class="mb-2">' + quote + '</div>' : '')
            + '<select id="explainType" class="' + field + ' mb-2">' + ATT_REASONS.map(x => '<option' + (r.note && r.note.type === x ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>'
            + '<textarea id="explainText" rows="3" maxlength="300" placeholder="e.g. Sent by my supervisor to install the POS at the Molino branch" class="' + field + '">' + (r.note ? esc(r.note.reason) : '') + '</textarea>'
            + '<div class="flex justify-end mt-2"><button id="explainSend" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3.5 py-2 rounded-md transition">' + (r.note ? 'Update explanation' : 'Send to coordinator') + '</button></div></div>');
        document.getElementById('explainSend').onclick = () => {
            const reason = document.getElementById('explainText').value.trim();
            if(reason.length < 5) return showToast('Write a short explanation first.', 'warn');
            const all = getJSON(ATT_NOTES_KEY, {});
            all[p.name + '|' + r.date] = {type: document.getElementById('explainType').value, reason, at: todayISO()};
            localStorage.setItem(ATT_NOTES_KEY, JSON.stringify(all));
            showToast('Explanation sent to your coordinator.', 'success');
            renderDayExplain(p, internAttendance(p).find(x => x.date === r.date));
        };
    }


}
