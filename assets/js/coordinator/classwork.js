// A task with submissions or approved logs is an OJT record: it can be archived but not deleted (5-year retention)
const taskLocked = (t) => t.turnedIn > 0 || t.approvedLogs > 0;

const repeatLabel = (r) => ['Friday', 'Monday'].includes(r) ? 'Repeats every ' + r : 'Repeats ' + r.charAt(0).toLowerCase() + r.slice(1);

const LOCKED_REASON = 'This task already has submissions, so it is kept as an OJT record for 5 years. Archive it instead.';

function taskMenuItem(act, icon, label, opts){
    opts = opts || {};
    const look = opts.blocked ? 'text-slate-300 cursor-not-allowed' : (opts.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50');
    return '<button data-task-act="' + act + '"' + (opts.blocked ? ' data-blocked="' + esc(opts.blocked) + '" title="' + esc(opts.blocked) + '"' : '')
      + ' class="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 ' + look + '"><i class="fa-solid ' + icon + ' w-3.5 text-center"></i>' + label + '</button>';
}
function taskCard(t){
    const status = TASK_STATUS[t.status] || TASK_STATUS.open;
    const done = t.turnedIn >= t.total;
    const del = taskMenuItem('delete', 'fa-trash', 'Delete', {danger: true, blocked: taskLocked(t) ? LOCKED_REASON : ''});
    const menu = t.status === 'archived'
        ? taskMenuItem('restore', 'fa-rotate-left', 'Restore') + del
        : taskMenuItem('edit', 'fa-pen', 'Edit') + taskMenuItem('duplicate', 'fa-copy', 'Duplicate')
          + (t.status === 'open' ? taskMenuItem('close', 'fa-lock', 'Close submissions') : taskMenuItem('reopen', 'fa-lock-open', 'Reopen submissions'))
          + taskMenuItem('archive', 'fa-box-archive', 'Archive') + del;
    return '<div data-task="' + esc(t.id) + '" class="task-card cursor-pointer bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-sky-300 transition' + (t.status === 'archived' ? ' opacity-80' : '') + '">'
      + '<div class="flex items-start justify-between gap-3"><div class="min-w-0">'
      + '<div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-slate-900 text-sm">' + esc(t.title) + '</span>'
      + (t.status !== 'open' ? '<span class="text-[10px] font-semibold border px-1.5 py-0.5 rounded-full ' + status[1] + '">' + status[0] + '</span>' : '') + '</div>'
      + (t.instructions ? '<p class="text-[12.5px] text-slate-500 mt-1">' + esc(t.instructions) + '</p>' : '')
      + '<div class="flex items-center gap-3 mt-2 text-[11.5px] text-slate-400 flex-wrap">'
      + '<span><i class="fa-regular fa-calendar mr-1"></i>' + dueLabel(t) + '</span>'
      + (t.repeat ? '<span><i class="fa-solid fa-rotate mr-1"></i>' + esc(repeatLabel(t.repeat)) + '</span>' : '')
      + (t.template ? '<span><i class="fa-regular fa-file-lines mr-1"></i>Template</span>' : '')
      + (t.attachments.length ? '<span><i class="fa-solid fa-paperclip mr-1"></i>' + t.attachments.length + ' attachment' + (t.attachments.length > 1 ? 's' : '') + '</span>' : '')
      + '<span><i class="fa-regular fa-star mr-1"></i>' + t.maxPoints + ' pts</span>'
      + '</div></div>'
      + '<div class="flex items-start gap-1.5 flex-shrink-0">'
      + '<span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border ' + (done ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-sky-700 bg-sky-50 border-sky-200') + '">' + t.turnedIn + ' / ' + t.total + ' Turned In</span>'
      + '<div class="relative"><button data-task-menu class="w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" title="More actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>'
      + '<div class="task-menu hidden absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">' + menu + '</div></div>'
      + '</div></div></div>';
}

let taskFilter = 'active';
function renderTasks(){
    const box = document.getElementById('taskList');
    if(!box) return;
    const mine = getAllTasks().filter(t => t.classCode === activeClassCode());
    const active = mine.filter(t => t.status !== 'archived');
    const archived = mine.filter(t => t.status === 'archived');
    document.getElementById('taskCountActive').textContent = '(' + active.length + ')';
    document.getElementById('taskCountArchived').textContent = '(' + archived.length + ')';
    document.querySelectorAll('.task-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === taskFilter));
    const list = taskFilter === 'archived' ? archived : active;
    box.innerHTML = list.map(taskCard).join('');
    const empty = document.getElementById('taskListEmpty');
    empty.textContent = taskFilter === 'archived' ? 'No archived tasks.' : 'No tasks yet. Click "Create New Task" to post one.';
    empty.classList.toggle('hidden', list.length > 0);
}
const closeTaskMenus = () => document.querySelectorAll('.task-menu').forEach(m => m.classList.add('hidden'));

// Create / Edit Task Modal
const taskModal = document.getElementById('taskModal');
let editingTaskId = null;
function openTaskModal(t){
    editingTaskId = t ? t.id : null;
    document.getElementById('taskModalTitle').textContent = t ? 'Edit Task' : 'Create New Task';
    document.getElementById('postTaskBtn').textContent = t ? 'Save Changes' : 'Post Task';
    document.getElementById('taskTitleInput').value = t ? t.title : '';
    document.getElementById('taskDescInput').value = t ? t.instructions : '';
    document.getElementById('taskDueDate').value = t ? (t.dueDate || '') : '';
    document.getElementById('taskDueTime').value = t ? (t.dueTime || '23:59') : '23:59';
    document.getElementById('taskMaxPoints').value = t ? t.maxPoints : 100;
    document.getElementById('taskTemplate').value = '';
    document.getElementById('taskAttachments').value = '';
    const tc = document.getElementById('taskTemplateCurrent');
    tc.classList.toggle('hidden', !(t && t.template));
    if(t && t.template) tc.innerHTML = 'Current template: ' + esc(t.template) + ' · choose a file to replace it';
    const ac = document.getElementById('taskAttachCurrent');
    ac.classList.toggle('hidden', !(t && t.attachments.length));
    if(t && t.attachments.length) ac.innerHTML = 'Current attachments: ' + esc(t.attachments.join(', ')) + ' · choosing files replaces them';
    const repeat = document.getElementById('repeatToggle');
    repeat.checked = !!(t && t.repeat);
    document.getElementById('taskRepeatSelect').value = (t && t.repeat) || 'Friday';
    document.getElementById('repeatIntervalRow').classList.toggle('hidden', !repeat.checked);
    document.getElementById('taskEditNote').classList.toggle('hidden', !(t && t.turnedIn > 0));
    taskModal.classList.remove('hidden');
}
on('openTaskModalBtn', 'click', () => openTaskModal(null));
on('closeTaskModalBtn', 'click', () => taskModal.classList.add('hidden'));
on('cancelTaskBtn', 'click', () => taskModal.classList.add('hidden'));
on('repeatToggle', 'change', function(){
    document.getElementById('repeatIntervalRow').classList.toggle('hidden', !this.checked);
});
on('postTaskBtn', 'click', async () => {
    const title = document.getElementById('taskTitleInput').value.trim();
    if(!title){ showToast('Enter a task title.', 'warn'); return; }
    const maxPoints = Number(document.getElementById('taskMaxPoints').value);
    if(!(maxPoints > 0)){ showToast('Max points must be more than 0.', 'warn'); return; }
    const fields = {
        title, maxPoints,
        instructions: document.getElementById('taskDescInput').value.trim(),
        dueDate: document.getElementById('taskDueDate').value,
        dueTime: document.getElementById('taskDueTime').value || '23:59',
        repeat: document.getElementById('repeatToggle').checked ? document.getElementById('taskRepeatSelect').value : ''
    };
    const tpl = document.getElementById('taskTemplate').files;
    const att = document.getElementById('taskAttachments').files;
    const selected = [...tpl, ...att];
    if(selected.some(file => file.size > 750000) || selected.reduce((sum, file) => sum + file.size, 0) > 2000000){
        showToast('Task files must be under 750 KB each and 2 MB together.', 'warn');
        return;
    }
    const fileData = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
        if(tpl.length){ fields.template = tpl[0].name; fields.templateData = await fileData(tpl[0]); }
        if(att.length){ fields.attachments = [...att].map(file => file.name); fields.attachmentData = await Promise.all([...att].map(fileData)); }
    } catch(e){ showToast('Could not read the selected task files. Please try again.', 'warn'); return; }
    if(editingTaskId){
        updateTask(editingTaskId, fields);
        showToast('"' + esc(title) + '" updated.', 'success');
    } else {
        const list = getAllTasks();
        list.unshift(Object.assign({id: 't' + Date.now().toString(36), classCode: activeClassCode(), attachment: null, status: 'open',
            turnedIn: 0, total: classCounts(activeClassCode()).interns, approvedLogs: 0, template: null, attachments: []}, fields));
        saveAllTasks(list);
        taskFilter = 'active';
        showToast('Task posted to your class stream.', 'success');
    }
    taskModal.classList.add('hidden');
    renderTasks();
});

// Task card menu: Edit, Duplicate, Close / Reopen, Archive / Restore, Delete
async function taskAction(id, act){
    const t = findTask(id);
    if(!t) return;
    const name = '"' + esc(t.title) + '"';
    if(act === 'edit'){ openTaskModal(t); return; }
    if(act === 'duplicate'){
        const list = getAllTasks();
        list.splice(list.findIndex(x => x.id === id), 0, Object.assign({}, t, {id: 't' + Date.now().toString(36), title: t.title + ' (copy)', status: 'open', turnedIn: 0, approvedLogs: 0}));
        saveAllTasks(list);
        showToast('Copy created. Edit it to change the title or due date.', 'success');
    }
    if(act === 'close' && !await askConfirm('Close submissions for ' + name + '? Students can no longer submit.')) return;
    if(act === 'close'){ updateTask(id, {status: 'closed'}); showToast('Submissions closed for ' + name + '. You can still review and grade.', 'info'); }
    if(act === 'reopen'){ updateTask(id, {status: 'open'}); showToast('Submissions reopened for ' + name + '.', 'success'); }
    if(act === 'archive'){
        if(!await askConfirm('Archive "' + t.title + '"? Students will no longer see it. Submissions and grades are kept.')) return;
        updateTask(id, {status: 'archived'});
        showToast(name + ' archived. You can restore it from the Archived tab.', 'info');
    }
    if(act === 'restore'){ updateTask(id, {status: 'closed'}); taskFilter = 'active'; showToast(name + ' restored with submissions closed. Reopen it if students still need to submit.', 'success'); }
    if(act === 'delete'){
        if(!await askConfirm('Delete "' + t.title + '"? This cannot be undone.')) return;
        saveAllTasks(getAllTasks().filter(x => x.id !== id));
        showToast(name + ' deleted.', 'warn');
    }
    renderTasks();
}

function initCoordinatorTaskList(){
    if(!document.getElementById('taskList')) return;
    document.getElementById('taskList').addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if(!card) return;
        const menuBtn = e.target.closest('[data-task-menu]');
        if(menuBtn){
            e.stopPropagation();
            const menu = menuBtn.nextElementSibling;
            const show = menu.classList.contains('hidden');
            closeTaskMenus();
            menu.classList.toggle('hidden', !show);
            return;
        }
        const item = e.target.closest('[data-task-act]');
        if(item){
            e.stopPropagation();
            closeTaskMenus();
            if(item.dataset.blocked){ showToast(item.dataset.blocked, 'warn'); return; }
            taskAction(card.dataset.task, item.dataset.taskAct);
            return;
        }
        if(e.target.closest('.task-menu')) return;
        window.location.href = pages.taskdetail + '?task=' + encodeURIComponent(card.dataset.task);
    });
    document.addEventListener('click', closeTaskMenus);
    document.querySelectorAll('.task-filter').forEach(b => b.addEventListener('click', () => { taskFilter = b.dataset.filter; renderTasks(); }));
    renderTasks();
    const editId = new URLSearchParams(window.location.search).get('edit');
    if(editId && findTask(editId)) openTaskModal(findTask(editId));
}
window.ICCore = window.ICCore || {};
window.ICCore.coordinator = window.ICCore.coordinator || {};
window.ICCore.coordinator.initTaskList = initCoordinatorTaskList;


// Batch Selector (switches the current batch)
function updateBatchBadge(){
    const cls = activeClass();
    const badge = document.getElementById('batchStatusBadge');
    if(!cls || !badge) return;
    badge.textContent = capitalize(cls.status);
    badge.className = 'text-[10.5px] font-semibold border px-2 py-0.5 rounded-full ' + STATUS_BADGE[cls.status];
}
function initCoordinatorBatchSelector(){
    if(!document.getElementById('batchSelect')) return;
    const sel = document.getElementById('batchSelect');
    const active = activeClassCode();
    sel.innerHTML = myClasses().filter(c => c.status !== 'archived').map(c =>
        '<option value="' + esc(c.code) + '"' + (c.code === active ? ' selected' : '') + '>' + esc(c.term) + ' · ' + esc(c.code) + '</option>').join('');
    updateBatchBadge();
    sel.addEventListener('change', () => {
        setActiveClass(sel.value);
        refreshHeaderCode();
        updateBatchBadge();
        renderTasks();
        showToast('Switched to ' + sel.options[sel.selectedIndex].text + '.', 'info');
    });
}
window.ICCore.coordinator.initBatchSelector = initCoordinatorBatchSelector;

(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    window.ICCore?.coordinator?.initTaskList?.();
    window.ICCore?.coordinator?.initBatchSelector?.();
  }, { once: true });
})();
