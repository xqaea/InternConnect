let currentTaskId = 'week5';
let currentSubIndex = 0;

// Show One Submission On The Right Side
function renderSubmissionDetail(taskId, index){
    const sub = taskInfo(taskId).submissions[index];
    document.getElementById('subDetailName').textContent = sub.name;
    document.getElementById('subDetailMeta').textContent = sub.meta;
    const statusEl = document.getElementById('subDetailStatus');
    statusEl.textContent = sub.status;
    statusEl.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-full border ' + sub.statusClass;
    document.getElementById('subDetailRaw').textContent = sub.raw;
    document.getElementById('subDetailBullet').textContent = sub.bullet;
    currentSubIndex = index;
    const g = getGrades()[gradeKey(taskId, sub.databaseReport?sub.email:sub.name)];
    document.getElementById('gradeInput').value = g ? g.score : '';
    document.getElementById('gradeFeedback').value = g ? g.feedback : '';
    document.getElementById('gradeMax').textContent = taskInfo(taskId).maxPoints;
}

// Fill In The Whole Task Detail Screen
function renderTaskDetail(taskId){
    const t = taskInfo(taskId);
    currentTaskId = taskId;
    document.getElementById('taskDetailTitle').textContent = t.title;
    document.getElementById('taskDetailInstructions').textContent = t.instructions;
    document.getElementById('taskDetailDue').innerHTML = '<i class="fa-regular fa-calendar mr-1"></i>' + t.due;
    document.getElementById('taskDetailCount').textContent = t.count;
    const attEl = document.getElementById('taskDetailAttachment');
    if(t.template){
      attEl.style.display = '';
      attEl.innerHTML = '<i class="fa-regular fa-file-lines mr-1"></i>Template: <a href="#" class="text-sky-600 hover:underline">' + esc(t.template) + '</a>';
    } else {
      attEl.style.display = 'none';
    }
    const alEl = document.getElementById('taskDetailAttachList');
    alEl.classList.toggle('hidden', !(t.attachments && t.attachments.length));
    if(t.attachments && t.attachments.length) alEl.innerHTML = '<i class="fa-solid fa-paperclip mr-1"></i>Attachments: ' + esc(t.attachments.join(', '));
    // Submissions List (left side)
    const list = document.getElementById('taskSubmissionsList');
    list.innerHTML = '';
    t.submissions.forEach((sub, i) => {
      const item = document.createElement('div');
      item.className = 'log-item border rounded-lg px-3 py-2.5 cursor-pointer ' + (i === 0 ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50');
      item.innerHTML = '<div class="text-[12.5px] font-semibold text-slate-900">' + esc(sub.name) + '</div><div class="text-[10.5px] text-slate-400">' + esc(subLine(taskId, sub)) + '</div>';
      item.addEventListener('click', () => {
        document.querySelectorAll('#taskSubmissionsList .log-item').forEach(el => { el.classList.remove('border-sky-300','bg-sky-50'); el.classList.add('border-slate-200'); });
        item.classList.remove('border-slate-200'); item.classList.add('border-sky-300','bg-sky-50');
        renderSubmissionDetail(taskId, i);
      });
      list.appendChild(item);
    });
    // Who has not turned in yet (only for real tasks: the sample tasks have sample numbers)
    const task = findTask(taskId);
    if(task && !TASK_SEED.some(x => x.id === taskId)){
        const sent = new Set(t.submissions.map(x => x.name));
        const missing = placementList(task.classCode).filter(p => !['Completed', 'Withdrawn'].includes(p.status) && !sent.has(p.name)).map(p => p.name).sort();
        if(missing.length) list.insertAdjacentHTML('beforeend', '<div class="px-2 pt-3 mt-1 border-t border-slate-100"><div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Not turned in (' + missing.length + ')</div><div class="text-[12px] text-slate-500 leading-relaxed">' + missing.map(esc).join(', ') + '</div></div>');
    }
    const statusEl = document.getElementById('taskDetailStatus');
    const status = t.status && t.status !== 'open' ? TASK_STATUS[t.status] : null;
    statusEl.classList.toggle('hidden', !status);
    if(status){ statusEl.textContent = status[0]; statusEl.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + status[1]; }
    const hasSubs = t.submissions.length > 0;
    document.getElementById('taskSplit').classList.toggle('hidden', !hasSubs);
    document.getElementById('taskNoSubs').classList.toggle('hidden', hasSubs);
    if(hasSubs) renderSubmissionDetail(taskId, 0);
}

// Load The Task From The Link (task-detail.html?task=week5)
function showTaskMissing(){
    document.getElementById('taskDetailTitle').textContent = 'Task not found';
    document.getElementById('taskDetailInstructions').textContent = "This task isn't in your current batch. It may have been deleted, or it belongs to another batch (switch batches on the Classwork page).";
    ['taskDetailDue', 'taskDetailAttachment', 'taskDetailAttachList', 'taskDetailCount', 'taskDetailStatus', 'td-editTaskBtn', 'taskSplit', 'taskNoSubs']
        .forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
}
function initCoordinatorTaskDetail(){
    if(!document.getElementById('taskSubmissionsList')) return;
    const id = new URLSearchParams(window.location.search).get('task');
    const t = id && findTask(id);
    if(t && t.classCode === activeClassCode()) renderTaskDetail(id);
    else showTaskMissing();
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initTaskDetail = initCoordinatorTaskDetail;

on('backToClassworkBtn', 'click', () => goTo('classwork'));
on('td-editTaskBtn', 'click', () => { window.location.href = pages.classwork + '?edit=' + encodeURIComponent(currentTaskId); });

// Approve, Revise, Reject and Export Buttons
function afterReview(){
    const i = currentSubIndex;
    renderTaskDetail(currentTaskId);
    document.querySelectorAll('#taskSubmissionsList .log-item').forEach((el, k) => { el.classList.toggle('border-sky-300', k === i); el.classList.toggle('bg-sky-50', k === i); el.classList.toggle('border-slate-200', k !== i); });
    renderSubmissionDetail(currentTaskId, i);
}
on('td-approveBtn', 'click', async () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    if(await reviewSubmission(currentTaskId, sub, 'Verified', document.getElementById('gradeFeedback').value.trim())===false) return;
    afterReview();
    showToast(sub.name + "'s log approved and pushed to verified resume.", 'success');
});
on('td-reviseBtn', 'click', async () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    const fb = await askInput('What should ' + sub.name + ' revise? The student will see this.', document.getElementById('gradeFeedback').value.trim());
    if(!fb || !fb.trim()) return;
    if(await reviewSubmission(currentTaskId, sub, 'Needs Revision', fb.trim())===false) return;
    afterReview();
    showToast('Revision requested — ' + sub.name + ' will be notified.', 'warn');
});
on('td-rejectBtn', 'click', async () => {
    const sub = taskInfo(currentTaskId).submissions[currentSubIndex];
    const fb = await askInput('Why is ' + sub.name + "'s log rejected? The student will see this.");
    if(!fb || !fb.trim()) return;
    if(await reviewSubmission(currentTaskId, sub, 'Rejected', fb.trim())===false) return;
    afterReview();
    showToast('Log rejected.', 'warn');
});
on('td-saveGradeBtn', 'click', async () => {
    const t = taskInfo(currentTaskId);
    const sub = t.submissions[currentSubIndex];
    const raw = document.getElementById('gradeInput').value;
    const score = Number(raw);
    if(raw === '' || isNaN(score) || score < 0 || score > t.maxPoints){
        return showToast('Enter a grade from 0 to ' + t.maxPoints + '.', 'warn');
    }
    if(sub.databaseReport){
        try{
            await window.ICCoordinatorApi.reviewReport(currentTaskId,{email:sub.email,version:sub.version,score,feedback:document.getElementById('gradeFeedback').value.trim()});
            cacheDatabaseReports((await window.ICCoordinatorApi.reports()).reports);
            afterReview();showToast('Grade saved.', 'success');
        }catch(error){showToast(error.message || 'Could not save the grade.', 'warn');}
        return;
    }
    const grades = getGrades();
    grades[gradeKey(currentTaskId, sub.name)] = {score, feedback: document.getElementById('gradeFeedback').value.trim()};
    localStorage.setItem('ic_grades', JSON.stringify(grades));
    const item = document.querySelectorAll('#taskSubmissionsList .log-item')[currentSubIndex];
    if(item) item.lastChild.textContent = subLine(currentTaskId, sub);
    showToast('Grade saved: ' + sub.name + ' got ' + score + '/' + t.maxPoints + '.', 'success');
});

(function () {
  'use strict';
  document.addEventListener('ic:coordinator-ready', () => {
    window.ICCore?.coordinator?.initTaskDetail?.();
  }, { once: true });
})();
