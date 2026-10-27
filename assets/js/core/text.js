window.ICText = window.ICText || {};
window.ICText.clean = function (value) {
    return String(value || '').replace(/\t/g, '    ');
};
window.ICText.fileSlug = function (value) {
    return String(value || '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
};
window.cleanText = window.ICText.clean;
window.fileSlug = window.ICText.fileSlug;
