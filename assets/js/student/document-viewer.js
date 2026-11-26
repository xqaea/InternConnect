/* Signed letters are requested on demand and are not stored in the browser cache. */
window.viewStudentDocument=file=>{
  const match=String(file?.data || '').match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
  if(!match)throw new Error('This document has no viewable file. Ask your coordinator to upload it again.');
  const binary=atob(match[2]);
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:match[1]}));
  const dialog=document.createElement('dialog');dialog.className='student-document-viewer';dialog.setAttribute('aria-label',file.name || 'Signed letter');
  const toolbar=document.createElement('div');toolbar.className='student-document-toolbar';
  const title=document.createElement('strong');title.textContent=file.name || 'Signed letter';
  const download=document.createElement('a');download.href=url;download.download=file.name || 'Signed letter';download.textContent='Download';
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();
  toolbar.append(title,download,close);dialog.appendChild(toolbar);
  const content=document.createElement(match[1]==='application/pdf'?'iframe':'img');
  content.src=url;content.className='student-document-content';
  if(content.tagName==='IFRAME')content.title=file.name || 'Signed letter';else content.alt=file.name || 'Signed letter';
  dialog.appendChild(content);
  dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});
  document.body.appendChild(dialog);dialog.showModal();
};
