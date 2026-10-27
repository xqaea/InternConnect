// Toast Notification
function showToast(message, type){
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icons = {success:'fa-circle-check', warn:'fa-triangle-exclamation', info:'fa-circle-info'};
    el.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

// Add Event Listener Only If The Element Exists On This Page
function on(id, eventName, handler){
    const el = document.getElementById(id);
    if(el) el.addEventListener(eventName, handler);
}

function esc(text){
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML.replace(/"/g, '&quot;');
}

function openModal(el){ el.classList.remove('hidden'); el.classList.add('flex'); }
function closeModal(el){ el.classList.add('hidden'); el.classList.remove('flex'); }
