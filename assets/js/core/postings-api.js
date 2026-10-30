(function(root){
  'use strict';
  const base = String(root.IC_APP_API_BASE || (location.protocol === 'https:' ? '/app-api' : 'http://' + (location.hostname || '127.0.0.1') + ':8001')).replace(/\/$/, '');
  async function request(path, options = {}){
    const {studentAuth, coordinatorAuth, ...fetchOptions} = options;
    const token = sessionStorage.getItem(coordinatorAuth ? 'ic_coordinator_token' : studentAuth ? 'ic_student_token' : 'ic_postings_token');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 7000);
    try{
      const response = await fetch(base + path, {...fetchOptions, signal: controller.signal,
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}), ...options.headers}});
      const body = await response.json();
      if(!response.ok){
        const detail = Array.isArray(body.detail) ? body.detail.map(item => item.msg).join(' ') : body.detail;
        const error = new Error(typeof detail === 'string' ? detail : detail?.message || 'Check the fields and try again.');
        error.retryAfter = Number(body.detail?.retry_after || response.headers.get('Retry-After') || 0);
        error.remainingAttempts = body.detail?.remaining_attempts;
        error.status = response.status; throw error;
      }
      return body;
    }finally{ clearTimeout(timer); }
  }
  root.ICPostingApi = {
    me: () => request('/api/partner/me'),
    attendance: () => request('/api/partner/attendance'),
    placements: () => request('/api/partner/placements'),
    applications: () => request('/api/partner/applications'),
    decideApplication: (id, status) => request('/api/partner/applications/' + encodeURIComponent(id), {method:'PUT', body:JSON.stringify({status})}),
    register: data => request('/api/auth/partner/register', {method: 'POST', body: JSON.stringify(data)}),
    login: (email, password) => request('/api/auth/partner/login', {method: 'POST', body: JSON.stringify({email, password})}),
    list: async (batch) => (await request('/api/postings?class_code=' + encodeURIComponent(batch))).postings,
    mine: async () => (await request('/api/partner/postings')).postings,
    save: async (posting, id) => (await request('/api/partner/postings' + (id ? '/' + encodeURIComponent(id) : ''), {method: id ? 'PUT' : 'POST', body: JSON.stringify(posting)})).id,
    logout: async () => { try { await request('/api/auth/partner/session', {method: 'DELETE'}); } finally { sessionStorage.removeItem('ic_postings_token'); } }
  };
  root.ICStudentApi = {
    placementDocuments: () => request('/api/student/placement/documents', {studentAuth:true}),
    placementDocument: kind => request('/api/student/placement/documents/'+encodeURIComponent(kind), {studentAuth:true}),
    reports: () => request('/api/student/reports', {studentAuth:true}),
    submitReport: (id,raw) => request('/api/student/tasks/'+encodeURIComponent(id)+'/report', {method:'POST',body:JSON.stringify({raw}),studentAuth:true}),
    tasks: () => request('/api/student/tasks', {studentAuth:true}),
    attendance: () => request('/api/student/attendance', {studentAuth:true}),
    clock: data => request('/api/student/attendance/clock', {method:'POST',body:JSON.stringify(data),studentAuth:true}),
    explainAttendance: data => request('/api/student/attendance/explanation', {method:'PUT',body:JSON.stringify(data),studentAuth:true}),
    placements: () => request('/api/student/placements', {studentAuth:true}),
    applications: () => request('/api/student/applications', {studentAuth:true}),
    apply: postingId => request('/api/student/applications', {method:'POST', body:JSON.stringify({postingId}), studentAuth:true}),
    register: data => request('/api/auth/student/register', {method: 'POST', body: JSON.stringify(data), studentAuth: true}),
    login: (email, password) => request('/api/auth/student/login', {method: 'POST', body: JSON.stringify({email, password}), studentAuth: true}),
    me: () => request('/api/auth/student/me', {studentAuth: true}),
    saveResume: data => request('/api/student/resume', {method: 'PUT', body: JSON.stringify(data), studentAuth: true}),
    savePhoto: avatar => request('/api/student/profile/photo', {method: 'PUT', body: JSON.stringify({avatar}), studentAuth: true}),
    logout: async () => { try { await request('/api/auth/student/session', {method: 'DELETE', studentAuth: true}); } finally { sessionStorage.removeItem('ic_student_token'); } }
  };
  const coordinatorRequest = (path, options = {}) => request(path, {...options, coordinatorAuth: true});
  const vaultRequest=(path,options={})=>{
    const role=JSON.parse(localStorage.getItem('ic_session') || '{}').role;
    const route=role==='partnercompany'?'partner':role;
    if(!['student','coordinator','partner'].includes(route))throw new Error('Sign in to open this vault.');
    return request('/api/'+route+'/vault/letters'+path,{...options,studentAuth:route==='student',coordinatorAuth:route==='coordinator'});
  };
  root.ICVaultApi={
    list:(company,code)=>vaultRequest('?company='+encodeURIComponent(company)+'&class_code='+encodeURIComponent(code)),
    upload:data=>vaultRequest('',{method:'POST',body:JSON.stringify(data)}),
    read:id=>vaultRequest('/'+encodeURIComponent(id)),
    remove:id=>vaultRequest('/'+encodeURIComponent(id),{method:'DELETE'})
  };
  root.ICNotificationApi = {
    list: role => request('/api/'+role+'/notifications',{studentAuth:role==='student',coordinatorAuth:role==='coordinator'}),
    read: (role,ids) => request('/api/'+role+'/notifications/read',{method:'POST',body:JSON.stringify({ids}),studentAuth:role==='student',coordinatorAuth:role==='coordinator'})
  };
  root.ICCoordinatorApi = {
    audit: code => coordinatorRequest('/api/coordinator/audit?class_code='+encodeURIComponent(code)),
    register: data => coordinatorRequest('/api/auth/coordinator/register', {method: 'POST', body: JSON.stringify(data)}),
    login: (email, password) => coordinatorRequest('/api/auth/coordinator/login', {method: 'POST', body: JSON.stringify({email, password})}),
    state: () => coordinatorRequest('/api/coordinator/state'),
    reports: () => coordinatorRequest('/api/coordinator/reports'),
    reviewReport: (id,data) => coordinatorRequest('/api/coordinator/tasks/'+encodeURIComponent(id)+'/report', {method:'PUT',body:JSON.stringify(data)}),
    tasks: () => coordinatorRequest('/api/coordinator/tasks'),
    saveTask: (data,id) => coordinatorRequest('/api/coordinator/tasks'+(id?'/'+encodeURIComponent(id):''), {method:id?'PUT':'POST',body:JSON.stringify(data)}),
    deleteTask: id => coordinatorRequest('/api/coordinator/tasks/'+encodeURIComponent(id), {method:'DELETE'}),
    attendance: () => coordinatorRequest('/api/coordinator/attendance'),
    reviewAttendance: data => coordinatorRequest('/api/coordinator/attendance/review', {method:'PUT',body:JSON.stringify(data)}),
    placements: () => coordinatorRequest('/api/coordinator/placements'),
    confirmDeployment: (id, data) => coordinatorRequest('/api/coordinator/applications/' + encodeURIComponent(id) + '/deployment', {method:'POST',body:JSON.stringify(data)}),
    applications: () => coordinatorRequest('/api/coordinator/applications'),
    partners: () => coordinatorRequest('/api/coordinator/partners'),
    decidePartner: (code, email, action) => coordinatorRequest('/api/coordinator/batches/' + encodeURIComponent(code) + '/partners/decision', {method: 'POST', body: JSON.stringify({email, action})}),
    createBatch: data => coordinatorRequest('/api/coordinator/batches', {method: 'POST', body: JSON.stringify(data)}),
    updateBatch: (code, data) => coordinatorRequest('/api/coordinator/batches/' + encodeURIComponent(code), {method: 'PUT', body: JSON.stringify(data)}),
    deleteBatch: code => coordinatorRequest('/api/coordinator/batches/' + encodeURIComponent(code), {method: 'DELETE'}),
    decide: (code, email, action) => coordinatorRequest('/api/coordinator/batches/' + encodeURIComponent(code) + '/students/decision', {method: 'POST', body: JSON.stringify({email, action})}),
    logout: async () => { try { await coordinatorRequest('/api/auth/coordinator/session', {method: 'DELETE'}); } finally { sessionStorage.removeItem('ic_coordinator_token'); } }
  };
})(window);
