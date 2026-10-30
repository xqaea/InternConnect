/* The same database record supplies company vaults and the student's own files. */
window.ICSharedLetters=(()=>{
  const contexts=new Map();
  const me=()=>getJSON('ic_session',{}) || {};
  const code=()=>me().role==='partnercompany'?me().classCode:activeClassCode();
  const enabled=()=>!!(me().databaseAccount && ['coordinator','partnercompany'].includes(me().role));
  const kind=type=>({'Endorsement letter':'endorsement','Acceptance letter':'acceptance'}[type]);
  async function load(company){
    const batch=code();
    const result=await window.ICVaultApi.list(company,batch);
    contexts.set(company+'|'+batch,result);
    ensureVault(company);
    updateVault(company,v=>{
      const people=new Map(result.interns.map(person=>[person.email,person]));
      result.files.forEach(file=>people.set(file.email,{id:file.studentId,email:file.email,name:file.studentName}));
      const folders=new Map();
      people.forEach(person=>{
        const duplicate=[...people.values()].filter(other=>other.name===person.name).length>1;
        let folder=v.folders.find(f=>f.internEmail===person.email) || (!duplicate && v.folders.find(f=>f.intern===person.name && !f.internEmail));
        if(!folder){folder={id:'shared-intern-'+person.id,parent:'interns',system:true,intern:person.name,name:duplicate?person.name+' ('+person.email+')':person.name};v.folders.push(folder);}
        folder.internEmail=person.email;folders.set(person.email,folder.id);
      });
      v.files=v.files.filter(file=>!file.sharedLetter);
      result.files.forEach(file=>v.files.push({...file,id:'shared-letter-'+file.id,letterId:file.id,sharedLetter:true,folder:folders.get(file.email),type:file.kind==='endorsement'?'Endorsement letter':'Acceptance letter'}));
    });
    return result;
  }
  async function save(company,folder,type,file,existing=null){
    const v=ensureVault(company),path=folderPath(v,folder),studentFolder=path.find(item=>item.intern);
    if(!studentFolder)throw new Error('Select this student’s folder to upload their letter.');
    const context=contexts.get(company+'|'+code()) || await load(company);
    const people=context.interns.filter(person=>studentFolder.internEmail?person.email===studentFolder.internEmail:person.name===studentFolder.intern);
    // Retained files can also be replaced after the application is completed.
    const email=existing?.email || (people.length===1?people[0].email:'');
    if(!email)throw new Error('Select the student’s own folder. Their company application must be available first.');
    const previous=existing || context.files.find(item=>item.email===email && item.kind===kind(type));
    await window.ICVaultApi.upload({company,classCode:code(),email,kind:kind(type),file,version:previous?.version || 0});
    await load(company);
  }
  return {enabled,kind,load,save,async read(file){return (await window.ICVaultApi.read(file.letterId)).document;},async remove(company,file){await window.ICVaultApi.remove(file.letterId);await load(company);}};
})();
