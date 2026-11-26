  // A circular portrait on white with explicit print density, shared by upload and PDF export.
  async function prepareResumePhoto(source){
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0,0,480,480);
    context.save();
    context.beginPath();
    context.arc(240,240,240,0,Math.PI*2);
    context.clip();
    const side = Math.min(image.naturalWidth,image.naturalHeight);
    context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,480,480);
    context.restore();
    let bytes = Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]),char=>char.charCodeAt(0));
    if(bytes[2]===255 && bytes[3]===224 && String.fromCharCode(...bytes.slice(6,11))==='JFIF\0'){
      bytes[13]=1; bytes[14]=1; bytes[15]=44; bytes[16]=1; bytes[17]=44;
    }else{
      const density = new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,1,44,1,44,0,0]);
      const updated = new Uint8Array(bytes.length+density.length);
      updated.set(bytes.slice(0,2)); updated.set(density,2); updated.set(bytes.slice(2),20); bytes=updated;
    }
    let binary='';
    bytes.forEach(byte=>{binary+=String.fromCharCode(byte);});
    return 'data:image/jpeg;base64,'+btoa(binary);
  }

  // Personal resumes use a separate layout from school-branded OJT documents.
  async function exportStudentResumePdf(filename, name, contact, sections, photo, toast, workExperiences=[], education=null){
    const Pdf = window.jspdf?.jsPDF;
    if(!Pdf) return toast('The PDF library could not load. Please try again.', 'warn');
    const doc = new Pdf({unit:'pt', format:'a4'});
    const width=doc.internal.pageSize.getWidth(), height=doc.internal.pageSize.getHeight();
    const margin=40, usable=width-margin*2;
    let y=margin+24;
    let photoBottom=margin;
    doc.setTextColor(0,0,0);
    if(photo){
      try{
        const prepared=await prepareResumePhoto(photo);
        doc.addImage(prepared,'JPEG',width-margin-115.2,margin,115.2,115.2);
        photoBottom=margin+115.2;
      }catch(error){return toast('Please upload the photo again, or export without a photo.', 'warn');}
    }
    const page=needed=>{if(y+needed>height-margin){doc.addPage();y=margin;}};
    const write=(value,size,bold,lineWidth=usable,style=bold?'bold':'normal')=>{
      doc.setFont('times',style);doc.setFontSize(size);
      const lines=doc.splitTextToSize(String(value),lineWidth);
      lines.forEach(line=>{page(size*1.25);doc.text(line,margin,y);y+=size*1.25;});
    };
    const headerWidth=photo?usable-131.2:usable;
    if(photo){
      doc.setFont('times','bold');doc.setFontSize(24);
      const nameHeight=doc.splitTextToSize(String(name),headerWidth).length*30;
      doc.setFont('times','normal');doc.setFontSize(11);
      const contactHeight=contact?6+doc.splitTextToSize(String(contact),headerWidth).length*13.75:0;
      y=margin+Math.max(0,(115.2-nameHeight-contactHeight)/2)+24;
    }
    write(name,24,true,headerWidth);y+=6;
    if(contact)write(contact,11,false,headerWidth);
    y=Math.max(y,photoBottom)+10;
    const populated=sections.filter(([,value])=>String(value||'').trim());
    const measuredLines=(value,size,bold)=>{
      doc.setFont('times',bold?'bold':'normal');doc.setFontSize(size);
      return doc.splitTextToSize(String(value),usable).length;
    };
    const items=value=>String(value).split('\n').map(line=>line.trim().replace(/^(?:[•●▪*-]|\d+[.)])\s+/, '')).filter(Boolean);
    const bulletLines=(value,size)=>{
      doc.setFont('times','normal');doc.setFontSize(size);
      return items(value).map(item=>doc.splitTextToSize(item,usable-12));
    };
    const estimate=(size,gap)=>y+populated.reduce((total,[heading,value])=>total+
      measuredLines(heading.toUpperCase(),14,true)*17.5+3+
      bulletLines(value,size).reduce((count,lines)=>count+lines.length,0)*size*1.25+gap,0);
    // Tighten a nearly full page before adding another, with a readable minimum.
    const bodySize=11;
    let sectionGap=9;
    if(estimate(11,9)>height-margin){
      if(estimate(11,5)<=height-margin)sectionGap=5;
    }
    sections.forEach(([heading,value])=>{
      if(!String(value||'').trim())return;
      page(measuredLines(heading.toUpperCase(),14,true)*17.5+3+
        Math.min(2,measuredLines(value,bodySize,false))*bodySize*1.25);
      write(heading.toUpperCase(),14,true);
      doc.setDrawColor(0,0,0);doc.setLineWidth(.4);
      doc.line(margin,y-8,width-margin,y-8);y+=3;
      if(heading==='Education' && education){
        const dates=window.ICResumeWork.range(education);
        doc.setFont('times','bold');doc.setFontSize(11);
        const dateWidth=dates?doc.getTextWidth(dates)+12:0;
        doc.setFont('times','bold');
        const programs=education.program?doc.splitTextToSize(education.program,usable-dateWidth):[];
        page(Math.max(1,Math.min(programs.length,2))*13.75+(education.school?12.5:0));
        if(dates)doc.text(dates,width-margin,y,{align:'right'});
        programs.forEach(line=>{page(13.75);doc.text(line,margin,y);y+=13.75;});
        if(!programs.length && dates)y+=13.75;
        if(education.school)write(education.school,10,false,usable,'italic');
      }else if(heading==='Summary' || heading==='Education'){
        write(value,bodySize,false);
      }else if(heading==='Work or Related Experience' && workExperiences.length){
        workExperiences.forEach((entry,index)=>{
          if(index) y+=6;
          const dates=window.ICResumeWork.range(entry);
          const display=window.ICResumeWork.presentation(entry);
          doc.setFont('times','bold');doc.setFontSize(11);
          const dateWidth=dates?doc.getTextWidth(dates)+12:0;
          doc.setFont('times','normal');
          const locationWidth=display.location?Math.min(usable*.45,doc.getTextWidth(display.location)):0;
          const locations=display.location?doc.splitTextToSize(display.location,locationWidth):[];
          doc.setFont('times','bold');
          const titles=doc.splitTextToSize(display.heading,usable-dateWidth);
          page(Math.min(titles.length,2)*13.75+((display.position || display.location)?13.75:0)+(entry.bullets?.length?13.75:0));
          titles.forEach((line,index)=>{
            page(13.75);doc.setFont('times','bold');doc.setFontSize(11);
            doc.text(line,margin,y);
            if(index===0 && dates)doc.text(dates,width-margin,y,{align:'right'});
            y+=13.75;
          });
          if(display.position || display.location){
            doc.setFont('times','bolditalic');doc.setFontSize(10);
            const positions=display.position?doc.splitTextToSize(display.position,usable-(locationWidth?locationWidth+12:0)):[];
            for(let line=0;line<Math.max(positions.length,locations.length);line++){
              page(13.75);doc.setFont('times','bolditalic');doc.setFontSize(10);
              if(positions[line])doc.text(positions[line],margin,y);
              doc.setFont('times','normal');doc.setFontSize(11);
              if(locations[line])doc.text(locations[line],width-margin,y,{align:'right'});
              y+=13.75;
            }
          }
          doc.setFont('times','normal');doc.setFontSize(11);
          (entry.bullets || []).forEach(bullet=>{
            const lines=doc.splitTextToSize(bullet,usable-24);
            lines.forEach((line,index)=>{page(13.75);if(index===0)doc.text('•',margin+12,y);doc.text(line,margin+24,y);y+=13.75;});
          });
        });
      }else if(['Soft Skills','Technical Skills'].includes(heading)){
        const skills=items(value);
        doc.setFont('times','normal');doc.setFontSize(10);
        for(let start=0;start<skills.length;start+=9){
          const band=skills.slice(start,start+9), count=Math.ceil(band.length/3);
          const columnWidth=(usable-32)/3;
          const columns=Array.from({length:count},(_,column)=>band.slice(column*3,column*3+3)
            .map(skill=>doc.splitTextToSize(skill,columnWidth-12)));
          const rowHeights=Array.from({length:3},(_,row)=>Math.max(0,...columns.map(column=>(column[row]?.length || 0)*12.5)));
          page(rowHeights.reduce((sum,value)=>sum+value,0));
          rowHeights.forEach((rowHeight,row)=>{
            columns.forEach((column,index)=>{
              const lines=column[row];if(!lines) return;
              const x=margin+index*(columnWidth+16);
              doc.text('•',x,y);
              lines.forEach((line,lineIndex)=>doc.text(line,x+12,y+lineIndex*12.5));
            });
            y+=rowHeight;
          });
        }
      }else bulletLines(value,bodySize).forEach(lines=>{
        lines.forEach((line,index)=>{
          page(bodySize*1.25);
          if(index===0)doc.text('•',margin,y);
          doc.text(line,margin+12,y);y+=bodySize*1.25;
        });
      });
      y+=sectionGap;
    });
    doc.save(filename);
  }

  function exportStudentDocumentPdf(filename, title, sections, toast){
    const Pdf = window.jspdf?.jsPDF;
    if(!Pdf) return toast('The PDF library could not load. Please check your connection and try again.', 'warn');
    const doc = new Pdf({unit:'pt', format:'a4'}), width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const margin = 48, lineWidth = width - margin * 2;
    addExportLogo(doc);
    doc.setTextColor(15, 23, 42);
    let y = 108;
    const line = (value, size, bold, gap) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      String(value || '').split('\n').forEach(part => {
        (doc.splitTextToSize(part || ' ', lineWidth) || [' ']).forEach(text => {
          if(y > height - 54){ doc.addPage(); y = 54; }
          doc.text(text, margin, y); y += size * 1.45;
        });
      });
      y += gap;
    };
    line(title, 17, true, 12);
    sections.forEach(([heading, value]) => {
      if(!String(value || '').trim()) return;
      // Keep the section heading with at least the first two lines of content.
      if(y + 65 > height - 54){ doc.addPage(); y = 54; }
      line(heading.toUpperCase(), 11, true, 5);
      line(value, 11, false, 13);
    });
    doc.save(filename);
  }
