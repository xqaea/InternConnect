// Read every field of a step (ids that start with "reg"), also tells which ones are empty
function collect(sectionId){
    const data = {}, empty = [];
    document.querySelectorAll('#' + sectionId + ' input[id^="reg"], #' + sectionId + ' select[id^="reg"]').forEach(el => {
        if(el.type === 'file') return;
        const v = el.value.trim();
        data[el.id.slice(3)] = v;
        if(!v) empty.push(el);
    });
    return {data, empty};
}

// Step 1: Profile Picture (resized to 128px so it is small enough to store)
on('avatarInput', 'change', function(){
    const file = this.files[0];
    if(!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const side = Math.min(img.width, img.height);
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        const preview = document.getElementById('avatarPreview');
        preview.src = data;
        preview.classList.remove('hidden');
        document.getElementById('avatarIcon').classList.add('hidden');
        saveDraft({avatar: data});
    };
    img.src = url;
});

// Step 1: Back / Next
on('regBack1', 'click', () => goTo('login'));
on('regNext1', 'click', () => {
    const {data, empty} = collect('tab-register1');
    document.getElementById('regStep1Error').classList.toggle('hidden', empty.length === 0);
    if(empty.length) return;
    if(currentRole() === 'partnercompany'){
        // Category labels map to program values for the existing class-code checks.
        data.Category = document.getElementById('regProgram').selectedOptions[0].textContent;
    }
    saveDraft(Object.assign(data, {role: currentRole()}));
    goTo('register2');
});
