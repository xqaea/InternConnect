function initStudentTaskRecords(me, mine, myTasks, mySub){
    // ---- Classwork and task detail: tasks posted by the coordinator ----
    const due = (t) => 'Due ' + formatDate(t.dueDate) + (t.dueTime ? ', ' + fmtClock(clockMins(t.dueTime)) : '');
    const files = (t) => (t.template ? '<span role="button" tabindex="0" data-task-file="template" data-task-id="' + esc(t.id) + '" class="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-file-lines"></i>Template: ' + esc(t.template) + '</span>' : '')
        + (t.attachments || []).map((a, i) => '<span role="button" tabindex="0" data-task-file="' + i + '" data-task-id="' + esc(t.id) + '" class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-paperclip"></i>' + esc(a) + '</span>').join('');
    document.addEventListener('click', e => {
        const item = e.target.closest('[data-task-file]'); if(!item) return;
        e.preventDefault(); e.stopPropagation();
        const task = getAllTasks().find(t => t.id === item.dataset.taskId);
        const template = item.dataset.taskFile === 'template';
        const index = Number(item.dataset.taskFile);
        const data = template ? task?.templateData : task?.attachmentData?.[index];
        const name = template ? task?.template : task?.attachments?.[index];
        if(!data) return showToast('This older task only saved the file name. Ask your coordinator to upload it again.', 'warn');
        const a = document.createElement('a'); a.href = data; a.download = name || 'Task file'; a.click();
    });
    document.addEventListener('keydown', e => { if(e.target.matches('[data-task-file]') && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); e.target.click(); } });
    const subBadge = (t) => {
        const st = mySub(t.id).status;
        const [txt, cls] = st ? [st, SUB_CLASS[st]] : t.status === 'closed' ? ['Closed', 'text-slate-500 bg-slate-100 border-slate-200'] : ['Not submitted', 'text-amber-600 bg-amber-50 border-amber-200'];
        return '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ' + cls + '">' + txt + '</span>';
    };
    const list = document.getElementById('loggingForm');
    if(list && document.getElementById('tab-classwork')){
        const tasks = myTasks();
        list.innerHTML = tasks.length ? tasks.map(t => '<a href="../student/task-detail.html?task=' + encodeURIComponent(t.id) + '" class="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-sky-300 transition">'
            + '<div class="flex items-start justify-between gap-3"><div><div class="font-semibold text-slate-900 text-sm">' + esc(t.title) + '</div><p class="text-[12.5px] text-slate-500 mt-1">' + esc(t.instructions || '') + '</p>'
            + '<div class="flex flex-wrap items-center gap-1.5 mt-2"><span class="text-[11.5px] text-slate-400 mr-1"><i class="fa-regular fa-calendar mr-1"></i>' + due(t) + '</span>' + files(t) + '</div></div>'
            + subBadge(t)
            + '</div></a>').join('') : '<div class="bg-white rounded-xl border border-slate-200 p-6 text-center text-[12.5px] text-slate-400">No tasks posted yet.</div>';
    }
    const t = document.getElementById('taskDetailTitle') && getAllTasks().find(x => x.id === new URLSearchParams(location.search).get('task'));
    if(t){
        document.getElementById('taskDetailTitle').textContent = t.title;
        document.getElementById('taskDetailInstructions').textContent = t.instructions || '';
        document.getElementById('taskDetailDue').innerHTML = '<i class="fa-regular fa-calendar mr-1"></i>' + due(t) + (t.maxPoints ? ' · ' + t.maxPoints + ' points' : '') + (t.status === 'closed' ? ' · submissions closed' : '');
        if(files(t)) document.getElementById('taskDetailDue').insertAdjacentHTML('afterend', '<div class="flex flex-wrap gap-1.5 mt-3">' + files(t) + '</div>' + (t.template ? '<p class="text-[11px] text-slate-400 mt-1.5">Download the template, fill it in, then paste or write your report below.</p>' : ''));
        const ta = document.getElementById('reportTextarea'), btn = document.getElementById('submitReportBtn');
        const renderMySub = () => {
            document.getElementById('mySubStatus')?.remove();
            const sub = mySub(t.id), g = getGrades()[gradeKey(t.id, me.databaseAccount?me.email:me.name)];
            if(!ta.dataset.loaded){ ta.value = sub.raw || ''; ta.dataset.loaded = '1'; ta.dispatchEvent(new Event('input')); }
            const locked = t.status === 'closed' || ['Pending Review', 'Verified', 'Rejected'].includes(sub.status);
            ta.readOnly = locked; btn.disabled = locked; btn.classList.toggle('opacity-50', locked); btn.classList.toggle('cursor-not-allowed', locked);
            if(!sub.status && t.status !== 'closed') return;
            document.getElementById('taskDetailTitle').parentElement.insertAdjacentHTML('beforeend', '<div id="mySubStatus" class="mt-3 text-[12.5px] rounded-md border px-3 py-2 ' + (sub.status ? SUB_CLASS[sub.status] : 'text-slate-500 bg-slate-50 border-slate-200') + '">'
                + (sub.status ? '<strong>' + sub.status + '</strong> · submitted ' + (sub.date ? formatDate(sub.date) : sub.meta.split(' · ')[0]) + (sub.status === 'Needs Revision' ? ' · edit your report and submit again' : '') : 'Submissions are closed.')
                + (sub.feedback ? '<div class="mt-1">Coordinator: “' + esc(sub.feedback) + '”</div>' : '')
                + (g ? '<div class="mt-1">Grade: ' + g.score + ' / ' + t.maxPoints + (g.feedback && g.feedback !== sub.feedback ? ' · ' + esc(g.feedback) : '') + '</div>' : '')
                + (sub.status === 'Verified' ? '<div class="mt-1">Added to your Verified Resume: “' + esc(sub.bullet) + '”</div>' : '') + '</div>');
        };
        renderMySub();
        btn.addEventListener('click', async () => {
            if(btn.disabled) return;
            const raw = ta.value.trim();
            if(!raw) return showToast('Write your report first.', 'warn');
            if(t.databaseTask){
                btn.disabled=true;
                try{
                    await window.ICStudentApi.submitReport(t.id,raw);
                    cacheDatabaseReports((await window.ICStudentApi.reports()).reports);
                    showToast('Report saved and submitted for coordinator review.', 'success');
                }catch(error){showToast(error.message || 'Could not submit the report.', 'warn');}
                finally{renderMySub();}
                return;
            }
            const all = getJSON(SUB_KEY, {}), first = !mySub(t.id).status, p = mine();
            all[t.id] = (all[t.id] || []).filter(x => x.name !== me.name).concat({name: me.name, raw, bullet: draftBullet(raw), company: p.company, date: todayISO(), status: 'Pending Review'});
            localStorage.setItem(SUB_KEY, JSON.stringify(all));
            const st = getJSON(SUB_STATUS_KEY, {}); delete st[t.id + '|' + me.name]; localStorage.setItem(SUB_STATUS_KEY, JSON.stringify(st));
            if(first) updateTask(t.id, {turnedIn: (findTask(t.id).turnedIn || 0) + 1});
            showToast('Report submitted for coordinator approval.', 'success');
            renderMySub();
        });
    }

    // ---- Verified Resume: approved accomplishment reports ----
    const vbox = document.getElementById('pv-verified');
    if(vbox){
        const ver = allTaskIds().map(id => [id, mySub(id)]).filter(([, x]) => x.status === 'Verified' && x.bullet);
        vbox.innerHTML = ver.length ? ver.map(([id, x]) => '<div class="flex items-start justify-between gap-3 text-[13px] text-slate-600"><p>' + esc(x.bullet) + '</p><span class="text-[10.5px] text-slate-400 whitespace-nowrap">' + esc(taskInfo(id).title) + '</span></div>').join('')
            + '<p class="text-[10.5px] text-slate-400">Ask your coordinator if a verified entry needs changes.</p>'
            : '<p class="text-[12.5px] text-slate-400">Your approved accomplishment reports will appear here.</p>';
    }


}
