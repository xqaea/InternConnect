window.ICDate = window.ICDate || {};
window.ICDate.todayISO = function () {
    const date = new Date();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};
window.ICDate.formatDate = function (iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
};
window.ICDate.retainUntil = function (iso) {
    return window.ICDate.formatDate(iso.replace(/^\d{4}/, year => String(Number(year) + 5)));
};
window.ICDate.dueLabel = function (task) {
    if (!task.dueDate) return 'No due date';
    const [hour, minute] = (task.dueTime || '23:59').split(':').map(Number);
    const time = ((hour % 12) || 12) + ':' + String(minute).padStart(2, '0') + ' ' + (hour < 12 ? 'AM' : 'PM');
    return 'Due ' + new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) + ', ' + time;
};
window.todayISO = window.ICDate.todayISO;
window.formatDate = window.ICDate.formatDate;
window.retainUntil = window.ICDate.retainUntil;
window.dueLabel = window.ICDate.dueLabel;
