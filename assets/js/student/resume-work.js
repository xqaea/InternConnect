/* Repeatable work experience, retaining the existing saved resume format. */
window.ICResumeWork={normalize(entry){
  if(entry.company!=null)return entry;
  // Older resumes stored the company as text and the work title as position.
  return {...entry,text:entry.position || entry.text || '',company:entry.position?entry.text || '':'',location:entry.location || ''};
},workplace(entry){return [entry.company,entry.location].filter(Boolean).join(' | ');},presentation(entry){
  return {heading:entry.company || entry.text,position:entry.company?entry.text:'',location:entry.location || ''};
},range(entry){
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return [entry.start,entry.end].filter(value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')).map(value=>names[Number(value.slice(5))-1]+' '+value.slice(0,4)).join(' - ');
},init(){
  const root=document.getElementById('workExperienceRows');
  if(!root) return null;
  const template=root.firstElementChild.cloneNode(true);
  let sequence=0;
  const entries=()=>[...root.children].map(row=>({
    text:row.querySelector('[data-work-title]').value.trim(),
    company:row.querySelector('[data-work-company]').value.trim(),
    location:row.querySelector('[data-work-location]').value.trim(),
    bullets:[...row.querySelectorAll('[data-work-bullet]')].map(input=>input.value.trim()).filter(Boolean),
    start:row.querySelector('[data-work-start]').value,
    end:row.querySelector('[data-work-end]').value
  })).filter(entry=>entry.text || entry.company || entry.location || entry.bullets.length || entry.start || entry.end);
  const add=(entry={})=>{
    entry=window.ICResumeWork.normalize(entry);
    const row=template.cloneNode(true),suffix=++sequence;
    row.classList.add('resume-work-edit');
    row.querySelectorAll('[id]').forEach(node=>{const previous=node.id;node.id=previous+'-'+suffix;row.querySelectorAll('label').forEach(label=>{if(label.htmlFor===previous) label.htmlFor=node.id;});});
    row.querySelector('[data-work-title]').value=entry.text || '';
    row.querySelector('[data-work-company]').value=entry.company || '';
    row.querySelector('[data-work-location]').value=entry.location || '';
    const bullets=row.querySelector('[data-work-bullets]');
    const addBullet=(value='')=>{
      const item=document.createElement('div');item.className='resume-bullet-edit';
      const mark=document.createElement('span');mark.textContent='•';mark.setAttribute('aria-hidden','true');
      const input=document.createElement('input');input.type='text';input.dataset.workBullet='';input.maxLength=2000;input.value=value;input.placeholder='Responsibility or achievement';input.setAttribute('aria-label','Experience bullet');
      const remove=document.createElement('button');remove.type='button';remove.className='resume-work-action';remove.textContent='Delete';remove.setAttribute('aria-label','Delete bullet');remove.onclick=()=>item.remove();
      item.append(mark,input,remove);bullets.appendChild(item);return input;
    };
    (entry.bullets || []).forEach(value=>addBullet(value));
    row.querySelector('[data-add-bullet]').onclick=()=>addBullet().focus();
    row.querySelector('[data-work-start]').value=entry.start || '';
    row.querySelector('[data-work-end]').value=entry.end || '';
    row.querySelector('[data-work-delete]').onclick=()=>{row.remove();if(!root.children.length) add();};
    root.appendChild(row);
    return row;
  };
  root.replaceChildren();add();
  document.getElementById('addWorkExperienceBtn').onclick=()=>add().querySelector('[data-work-company]').focus();
  return {
    entries,
    load(saved){
      const fields=saved.fields || {};
      const list=Array.isArray(saved.workExperiences)?saved.workExperiences:[{text:fields['ed-workexp'] || '',start:fields['ed-workStart'] || '',end:fields['ed-workEnd'] || ''}];
      root.replaceChildren();(list.length?list:[{}]).forEach(entry=>add(entry));
    },
    validate(toast){
      for(const entry of entries()){
        if(!entry.text || ((entry.start || entry.end) && (!entry.start || !entry.end || entry.start>entry.end))){
          toast('Add a work title and choose valid start and end months, or leave both dates empty.','warn');return false;
        }
      }
      return true;
    },
    text(format){return entries().map(entry=>{const display=window.ICResumeWork.presentation(entry);return [format([display.heading,display.location].filter(Boolean).join(' | '),{'ed-workStart':entry.start,'ed-workEnd':entry.end},'work'),display.position,...entry.bullets.map(text=>'• '+text)].filter(Boolean).join('\n');}).join('\n');},
    renderPreview(target){
      target.replaceChildren();
      entries().forEach(entry=>{
        const display=window.ICResumeWork.presentation(entry);
        const article=document.createElement('div');article.className='resume-work-entry';
        const heading=document.createElement('div');heading.className='resume-work-heading';
        const title=document.createElement('strong');title.textContent=display.heading;
        const location=document.createElement('span');location.className='resume-work-location';location.textContent=display.location;
        const dates=document.createElement('span');dates.className='resume-work-dates';
        dates.textContent=window.ICResumeWork.range(entry);
        heading.append(title,dates);article.appendChild(heading);
        if(display.position || display.location){
          const subheading=document.createElement('div');subheading.className='resume-work-heading resume-work-subheading';
          const position=document.createElement('div');position.className='resume-work-position';position.textContent=display.position;
          subheading.append(position,location);article.appendChild(subheading);
        }
        if(entry.bullets.length){const list=document.createElement('ul');entry.bullets.forEach(text=>{const item=document.createElement('li');item.textContent=text;list.appendChild(item);});article.appendChild(list);}
        target.appendChild(article);
      });
    }
  };
}};
