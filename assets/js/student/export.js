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
  async function exportStudentResumePdf(filename, name, contact, sections, photo, toast){
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
    const write=(value,size,bold,lineWidth=usable)=>{
      doc.setFont('times',bold?'bold':'normal');doc.setFontSize(size);
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
      if(['Soft Skills','Technical Skills'].includes(heading)){
        const skills=items(value);
        doc.setFont('times','normal');doc.setFontSize(bodySize);
        for(let start=0;start<skills.length;start+=12){
          const band=skills.slice(start,start+12), count=Math.ceil(band.length/4);
          const columnWidth=(usable-16*(count-1))/count;
          const columns=Array.from({length:count},(_,column)=>band.slice(column*4,column*4+4)
            .map(skill=>doc.splitTextToSize(skill,columnWidth-12)));
          const bandHeight=Math.max(...columns.map(column=>column.reduce((height,lines)=>height+lines.length*13.75,0)));
          page(bandHeight);
          const top=y;
          columns.forEach((column,index)=>{
            let lineY=top;
            const x=margin+index*(columnWidth+16);
            column.forEach(lines=>{
              doc.text('•',x,lineY);
              lines.forEach(line=>{doc.text(line,x+12,lineY);lineY+=13.75;});
            });
          });
          y=top+bandHeight;
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
