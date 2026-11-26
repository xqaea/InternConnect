/* Shared calendar for date inputs, month inputs and attendance records. */
(() => {
  'use strict';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const iso = date => String(date.getFullYear()).padStart(4,'0') + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  const monthDate = (year, month) => { const date=new Date(); date.setFullYear(year,month,1); date.setHours(0,0,0,0); return date; };
  function element(tag, className, text) {
    const node=document.createElement(tag);
    if(className) node.className=className;
    if(text!==undefined) node.textContent=text;
    return node;
  }
  function mount(root, options={}) {
    let view=root._calendarView || (options.value ? new Date(options.value.slice(0,7)+'-01T00:00:00') : new Date());
    if(Number.isNaN(view.getTime())) view=new Date();
    view=monthDate(view.getFullYear(),view.getMonth());
    let choosingMonth=false;
    const today=iso(new Date());
    const allowed=value => (!options.min || value>=options.min) && (!options.max || value<=options.max);
    function changeMonth(offset) {
      const next=monthDate(view.getFullYear(),view.getMonth()+offset);
      if(next.getFullYear()<1 || next.getFullYear()>9999) return;
      view=next; choosingMonth=false; render();
    }
    function render() {
      root._calendarView=view;
      root.replaceChildren();
      root.classList.add('ic-calendar');
      const header=element('div','ic-calendar-header');
      const title=element('button','ic-calendar-title',months[view.getMonth()]+' '+view.getFullYear());
      title.type='button';title.setAttribute('aria-label','Choose month and year');title.setAttribute('aria-expanded',String(choosingMonth));
      title.onclick=()=>{choosingMonth=!choosingMonth;render();(choosingMonth?root.querySelector('.ic-calendar-month'):root.querySelector('.ic-calendar-title')).focus();};
      const jump=element('div','ic-calendar-jump');jump.hidden=!choosingMonth;
      const month=element('select','ic-calendar-month');
      month.setAttribute('aria-label','Month');
      months.forEach((name,index)=>{const option=element('option','',name);option.value=index;month.appendChild(option);});
      month.value=view.getMonth();
      month.addEventListener('change',()=>{view=monthDate(view.getFullYear(),Number(month.value));render();root.querySelector('.ic-calendar-month').focus();});
      const year=element('input','ic-calendar-year');
      year.type='number';year.min='1';year.max='9999';year.value=view.getFullYear();year.setAttribute('aria-label','Year');
      const commitYear=()=>{const value=Number(year.value);if(Number.isInteger(value)&&value>=1&&value<=9999){if(value===view.getFullYear()) return;view=monthDate(value,view.getMonth());render();root.querySelector('.ic-calendar-year').focus();}else year.value=view.getFullYear();};
      year.addEventListener('change',commitYear);
      year.addEventListener('input',()=>{if(/^\d{4}$/.test(year.value)) commitYear();});
      year.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitYear();}});
      jump.append(month,year);
      const arrows=[-1,1].map(offset=>{
        const button=element('button','ic-calendar-arrow',offset<0?'<':'>');
        button.type='button';button.setAttribute('aria-label',offset<0?'Previous month':'Next month');
        button.disabled=(offset<0&&view.getFullYear()===1&&view.getMonth()===0)||(offset>0&&view.getFullYear()===9999&&view.getMonth()===11);
        button.onclick=()=>{changeMonth(offset);root.querySelectorAll('.ic-calendar-arrow')[offset<0?0:1].focus();};
        return button;
      });
      header.append(arrows[0],title,arrows[1]);root.append(header,jump);
      const grid=element('div','ic-calendar-grid');
      grid.setAttribute('aria-label',months[view.getMonth()]+' '+view.getFullYear());
      weekdays.forEach(day=>grid.appendChild(element('span','ic-calendar-weekday',day)));
      const leading=(view.getDay()+6)%7;
      const total=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
      const cells=Math.ceil((leading+total)/7)*7;
      for(let index=0;index<cells;index++){
        const day=index-leading+1;
        if(day<1 || day>total){const blank=element('span','ic-calendar-day');blank.setAttribute('aria-hidden','true');grid.appendChild(blank);continue;}
        const date=monthDate(view.getFullYear(),view.getMonth());date.setDate(day);
        const key=iso(date),value=options.mode==='month'?key.slice(0,7):key;
        const record=options.records?.[key];
        const interactive=!options.readOnly || !!record;
        const cell=element(interactive?'button':'span','ic-calendar-day');
        if(interactive){cell.type='button';cell.disabled=!allowed(value);cell.onclick=()=>{options.value=value;render();options.onSelect?.(value);};cell.dataset.calendarDate=key;}
        cell.setAttribute('aria-label',date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+(record?', '+record.status:''));
        const number=element('span','ic-calendar-number',day);
        if(key===today){number.classList.add('is-today');cell.setAttribute('aria-current','date');}
        if(options.mode!=='month' && value===options.value) number.classList.add('is-selected');
        cell.appendChild(number);
        if(record){cell.title=record.status;cell.appendChild(element('span','ic-calendar-record','•'));}
        grid.appendChild(cell);
      }
      root.appendChild(grid);
      const footer=element('div','ic-calendar-footer');
      [['Today',0],['Tomorrow',1],['Next Week',7]].forEach(([label,offset])=>{
        const date=new Date();date.setDate(date.getDate()+offset);
        const key=iso(date),value=options.mode==='month'?key.slice(0,7):key;
        const button=element('button','ic-calendar-shortcut',label);
        button.type='button';button.disabled=!allowed(value);
        button.title=label==='Next Week'?'Seven days from today':label;
        button.onclick=()=>{
          view=monthDate(date.getFullYear(),date.getMonth());options.value=value;render();
          if(!options.readOnly) options.onSelect?.(value);
        };
        footer.appendChild(button);
      });
      root.appendChild(footer);
    }
    root.onkeydown=event=>{
      const cell=event.target.closest('[data-calendar-date]');
      if(!cell) return;
      const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
      if(!(event.key in offsets)) return;
      event.preventDefault();
      const next=new Date(cell.dataset.calendarDate+'T00:00:00');next.setDate(next.getDate()+offsets[event.key]);
      if(next.getFullYear()<1 || next.getFullYear()>9999) return;
      view=monthDate(next.getFullYear(),next.getMonth());render();
      root.querySelector('[data-calendar-date="'+iso(next)+'"]')?.focus();
    };
    render();
  }
  function mountPicker(root,input,onSelect,onCancel) {
    const mobile=window.matchMedia('(max-width: 767px)').matches;
    const settleColumns=[];
    const monthOnly=input.type==='month';
    let initial=input.value || (monthOnly?iso(new Date()).slice(0,7):iso(new Date()));
    if(input.min && initial<input.min) initial=input.min;
    if(input.max && initial>input.max) initial=input.max;
    const parsed=new Date(initial+(monthOnly?'-01':'')+'T00:00:00');
    let year=parsed.getFullYear(),month=parsed.getMonth(),day=parsed.getDate();
    if(Number.isNaN(year)){const now=new Date();year=now.getFullYear();month=now.getMonth();day=now.getDate();}
    root.replaceChildren();
    const title=element('div','ic-picker-title',monthOnly?'Choose month and year':'Choose date');
    const columns=element('div','ic-picker-columns');
    const message=element('p','ic-picker-message');message.setAttribute('role','status');
    const footer=element('div','ic-picker-footer');
    const clear=element('button','','Clear');clear.type='button';clear.onclick=()=>onSelect('');
    const cancel=element('button','','Cancel');cancel.type='button';cancel.onclick=onCancel;
    const done=element('button','ic-picker-done','Done');done.type='button';
    const value=()=>String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+(monthOnly?'':'-'+String(day).padStart(2,'0'));
    done.onclick=()=>{settleColumns.forEach(settle=>settle());refresh();if(!done.disabled) onSelect(value());};
    footer.append(clear,cancel,done);root.append(title,columns,message,footer);
    const days=()=>new Date(year,month+1,0).getDate();
    let dayControl=null;
    const refresh=()=>{
      const count=days();day=Math.min(day,count);
      dayControl?.update(Array.from({length:count},(_,i)=>i+1),day);
      done.disabled=!!((input.min&&value()<input.min)||(input.max&&value()>input.max));
      message.textContent=done.disabled?'This date is outside the allowed range.':'';
    };
    function column(label,values,selected,format,onChange,loop=false) {
      const wrapper=element('div','ic-picker-column');
      const caption=element('span','ic-picker-label',label);
      wrapper.appendChild(caption);columns.appendChild(wrapper);
      if(!mobile){
        const select=element('select','ic-picker-select');select.setAttribute('aria-label',label);wrapper.appendChild(select);
        const update=(list,current)=>{
          if(select.options.length!==list.length){select.replaceChildren();list.forEach(value=>{const option=element('option','',format(value));option.value=value;select.appendChild(option);});}
          select.value=current;
        };
        update(values,selected);select.onchange=()=>onChange(Number(select.value));
        return {update};
      }
      const frame=element('div','ic-wheel-frame');
      const wheel=element('div','ic-picker-wheel');wheel.tabIndex=0;wheel.setAttribute('role','listbox');wheel.setAttribute('aria-label',label);
      frame.appendChild(wheel);wrapper.appendChild(frame);
      let list=[],current=selected,timer=null,ignore=false;
      let highlighted=null;
      const paint=()=>{const next=wheel.children[Math.round(wheel.scrollTop/36)];if(next===highlighted) return;highlighted?.setAttribute('aria-selected','false');next?.setAttribute('aria-selected','true');highlighted=next;};
      const update=(items,chosen)=>{
        clearTimeout(timer);current=chosen;
        list=loop?Array.from({length:5},()=>items).flat():items;
        wheel.replaceChildren();
        list.forEach((value,index)=>{
          const option=element('div','ic-wheel-option',format(value));option.setAttribute('role','option');
          option.onclick=()=>{wheel.scrollTop=index*36;settle();};wheel.appendChild(option);
        });
        ignore=true;
        wheel.scrollTop=(list.indexOf(chosen)+(loop?items.length*2:0))*36;
        paint();requestAnimationFrame(()=>{ignore=false;});
      };
      const settle=()=>{
        clearTimeout(timer);
        const index=Math.max(0,Math.min(list.length-1,Math.round(wheel.scrollTop/36)));
        const chosen=list[index];wheel.scrollTop=index*36;paint();
        if(chosen!==current){current=chosen;onChange(chosen);}
        if(loop && (index<values.length || index>=values.length*4)) update(values,chosen);
        if(label==='Year' && (index<15 || index>list.length-16)){
          const start=Math.max(1,chosen-50),end=Math.min(9999,chosen+50);
          update(Array.from({length:end-start+1},(_,i)=>start+i),chosen);
        }
      };
      wheel.onscroll=()=>{if(ignore) return;paint();clearTimeout(timer);timer=setTimeout(settle,120);};
      settleColumns.push(settle);
      wheel.onkeydown=event=>{
        const offsets={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5};
        if(!(event.key in offsets)) return;
        event.preventDefault();wheel.scrollTop+=offsets[event.key]*36;settle();
      };
      // The popover must be visible before measuring or setting its scroll position.
      requestAnimationFrame(()=>update(values,selected));
      return {update};
    }
    column('Month',Array.from({length:12},(_,i)=>i),month,value=>months[value],value=>{month=value;refresh();},true);
    const start=Math.max(1,year-(mobile?50:100)),end=Math.min(9999,year+(mobile?50:100));
    column('Year',Array.from({length:end-start+1},(_,i)=>start+i),year,String,value=>{year=value;refresh();});
    if(!monthOnly) dayControl=column('Day',Array.from({length:days()},(_,i)=>i+1),day,String,value=>{day=value;refresh();});
    refresh();
  }
  window.ICCalendar={mount};
  let popup=null,activeInput=null;
  function close() {popup?.hidePopover();activeInput?.focus();}
  function position() {
    if(!popup?.matches(':popover-open') || !activeInput) return;
    const anchor=activeInput.getBoundingClientRect(),width=popup.offsetWidth,height=popup.offsetHeight;
    popup.style.left=Math.max(8,Math.min(anchor.left,window.innerWidth-width-8))+'px';
    popup.style.top=Math.max(8,anchor.bottom+height+8<=window.innerHeight?anchor.bottom+4:Math.min(anchor.top-height-4,window.innerHeight-height-8))+'px';
  }
  function open(input) {
    if(input.disabled || input.readOnly) return;
    if(!popup){
      popup=element('div','ic-calendar-popup ic-date-picker');popup.id='icCalendarPicker';popup.setAttribute('popover','auto');popup.setAttribute('role','dialog');
      popup.addEventListener('toggle',event=>{if(event.newState==='closed') activeInput?.setAttribute('aria-expanded','false');});
    }
    if(popup.isConnected && popup.matches(':popover-open')) popup.hidePopover();
    activeInput?.setAttribute('aria-expanded','false');activeInput=input;
    (input.closest('dialog[open]') || document.body).appendChild(popup);
    const resumeMonth=document.body.dataset.page==='resume' && input.type==='month';
    popup.className='ic-calendar-popup'+(resumeMonth?' ic-date-picker':'');
    popup.onkeydown=null;
    popup.setAttribute('aria-label',resumeMonth?'Choose month and year':'Choose a date');
    const select=value=>{
      input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();
    };
    if(resumeMonth) mountPicker(popup,input,select,close);
    else {
      popup._calendarView=null;
      mount(popup,{value:input.value,min:input.min,max:input.max,mode:input.type,onSelect:select,onClose:close});
    }
    input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','true');
    popup.showPopover();position();
    const focus=resumeMonth?popup.querySelector('select,[role="listbox"]'):
      popup.querySelector('.is-selected')?.closest('button:not(:disabled)') || popup.querySelector('[aria-current="date"]:not(:disabled)') || popup.querySelector('[data-calendar-date]:not(:disabled)');
    focus?.focus();
  }
  document.addEventListener('click',event=>{
    const input=event.target.closest('input[type="date"],input[type="month"]');
    if(!input || input.disabled || input.readOnly) return;
    event.preventDefault();event.stopImmediatePropagation();open(input);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.target.matches('input[type="date"],input[type="month"]') && (event.key==='Enter' || event.key===' ' || (event.altKey&&event.key==='ArrowDown'))){event.preventDefault();event.stopImmediatePropagation();open(event.target);}
  },true);
  let positionFrame=0;
  const schedulePosition=()=>{if(positionFrame) return;positionFrame=requestAnimationFrame(()=>{positionFrame=0;position();});};
  window.addEventListener('resize',schedulePosition);
  document.addEventListener('scroll',event=>{if(popup?.contains(event.target)) return;schedulePosition();},true);
})();
