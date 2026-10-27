/* ============ Partner directory: office location and geofence ============ */
function renderSiteLines(){
    document.querySelectorAll('.open-vault-btn').forEach(btn => {
        const c = btn.dataset.company, site = companySite(c), custom = !!getJSON(SITES_KEY, {})[c];
        btn.parentElement.querySelector('.site-line')?.remove();
        btn.insertAdjacentHTML('beforebegin', '<div class="site-line mt-3 flex items-center justify-between gap-2 text-[11.5px] border border-slate-200 rounded-md px-2.5 py-1.5">'
            + '<div class="min-w-0"><div class="text-slate-700 truncate"><i class="fa-solid fa-location-dot text-sky-600 mr-1"></i>' + esc(site.place) + '</div><div class="text-[10.5px] text-slate-400">Geofence ' + site.radius + ' m' + (custom ? '' : ' · sample pin, please confirm') + '</div></div>'
            + '<button class="site-edit-btn text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex-shrink-0" data-company="' + esc(c) + '">Edit</button></div>');
    });
}
function openSiteModal(company){
    let m = document.getElementById('siteModal');
    const field = 'w-full border border-slate-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-sky-400';
    if(!m){
        document.body.insertAdjacentHTML('beforeend', '<div id="siteModal" class="hidden fixed inset-0 bg-black/40 z-50 items-center justify-center p-4"><div class="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">'
          + '<div class="flex items-center justify-between mb-1"><h3 class="font-bold text-slate-900">Office location &amp; geofence</h3><button data-site="close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button></div>'
          + '<p id="siteCompany" class="text-[12px] text-slate-500 mb-4"></p>'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mb-1" for="sitePlace">Place name</label><input id="sitePlace" class="' + field + ' mb-3">'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mb-1" for="siteCoords">Location</label><div class="flex gap-2 mb-1"><input id="siteCoords" placeholder="Paste a Google Maps link or lat, lng" class="' + field + '">'
          + '<button data-site="here" class="text-[11.5px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-2.5 rounded-md whitespace-nowrap" title="Use while you are at the company"><i class="fa-solid fa-crosshairs mr-1"></i>Use my location</button></div>'
          + '<a id="sitePreview" target="_blank" rel="noopener" class="text-[11.5px] text-sky-600 hover:underline"><i class="fa-solid fa-map-location-dot mr-1"></i>Check the pin on Google Maps</a>'
          + '<label class="text-[12.5px] font-medium text-slate-600 block mt-3 mb-1" for="siteRadius">Geofence radius</label><select id="siteRadius" class="' + field + '">' + RADIUS_OPTIONS.map(r => '<option value="' + r + '">' + r + ' m</option>').join('') + '</select>'
          + '<p class="text-[11px] text-slate-400 mt-1.5">Use a bigger radius for large compounds or weak GPS indoors. Clock-ins outside it are flagged for your review. Past records keep their status.</p>'
          + '<div class="flex justify-end gap-2.5 mt-5"><button data-site="close" class="text-[12.5px] font-medium text-slate-500 hover:text-slate-700 px-3.5 py-2">Cancel</button><button data-site="save" class="text-[12.5px] font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2.5 rounded-md">Save</button></div></div></div>');
        m = document.getElementById('siteModal');
        const preview = () => { const c = parseCoords(document.getElementById('siteCoords').value); const a = document.getElementById('sitePreview'); a.classList.toggle('hidden', !c); if(c) a.href = mapsLink(c); };
        m.addEventListener('input', preview);
        m.addEventListener('click', (e) => {
            const b = e.target.closest('[data-site]');
            if(!b) return;
            if(b.dataset.site === 'close'){ closeModal(m); return; }
            if(b.dataset.site === 'here'){
                if(!navigator.geolocation) return showToast('Location is not available on this device.', 'warn');
                navigator.geolocation.getCurrentPosition(pos => { document.getElementById('siteCoords').value = pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5); preview(); },
                    () => showToast('Location permission was not granted.', 'warn'), {enableHighAccuracy: true, timeout: 10000});
                return;
            }
            const c = parseCoords(document.getElementById('siteCoords').value), place = document.getElementById('sitePlace').value.trim(), radius = Number(document.getElementById('siteRadius').value);
            if(!c || !place) return showToast('Add the place name and a valid location.', 'warn');
            const all = getJSON(SITES_KEY, {});
            all[m._company] = {lat: c.lat, lng: c.lng, place, radius};
            localStorage.setItem(SITES_KEY, JSON.stringify(all));
            logAudit('Set the office location of ' + m._company + ' to ' + c.lat + ', ' + c.lng + ' (geofence ' + radius + ' m)');
            closeModal(m);
            renderSiteLines();
            showToast('Location saved. New clock-ins at ' + esc(m._company) + ' are checked against ' + radius + ' m.', 'success');
        });
    }
    const site = companySite(company);
    m._company = company;
    document.getElementById('siteCompany').textContent = company + ' · clock-ins are checked against this pin';
    document.getElementById('sitePlace').value = site.place;
    document.getElementById('siteCoords').value = site.lat + ', ' + site.lng;
    document.getElementById('siteRadius').value = String(site.radius);
    document.getElementById('sitePreview').href = mapsLink(site);
    openModal(m);
}
document.addEventListener('click', (e) => { const b = e.target.closest('.site-edit-btn'); if(b) openSiteModal(b.dataset.company); });
