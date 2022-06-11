function ParseSianetSubject(str) {
    let parsed = str.trim();
    if (parsed === "")
        parsed = chrome.i18n.getMessage("no_subject_assignment")
    return titleize(parsed);
}

function ParseSianetType(str) { // i.e.: _TAREA = Tarea
    let parsed = str.replaceAll(/_/g, ' ');
    return titleize(parsed);
}

function titleize(str) { // i.e.: HELLO WORLD = Hello World
    let upper = true
    let newStr = ""
    for (let i = 0, l = str.length; i < l; i++) {
        if (str[i] ===   " ") {
            upper = true
            newStr += str[i]
            continue
        }
        newStr += upper ? str[i].toUpperCase() : str[i].toLowerCase()
        upper = false
    }
    return newStr
}

function ParseDate(str) {
    let date = new Date(str);
    date.setHours(0, 0, 0, 0);
    
    let yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(0, 0, 0, 0);
    
    if (date.getTime() === yesterday.getTime()) {
        return chrome.i18n.getMessage("yesterday");
    }
    if (date.getTime() === today.getTime()) {
        return chrome.i18n.getMessage("today");
    }
    if (date.getTime() === tomorrow.getTime()) {
        return chrome.i18n.getMessage("tomorrow");
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function DateToTD(date, classname) {
    let parsedDate = ParseDate(date);
    if (parsedDate === chrome.i18n.getMessage("today") || parsedDate === chrome.i18n.getMessage("tomorrow"))
        return `<td class="${classname} special">` + parsedDate + '</td>'

    return `<td class="${classname}">` + parsedDate + '</td>'
}

function RemoveDiacritics(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function FirstSubdomainFromURLString(url) { 
    let subdomains = new URL(url).pathname.substring(1);
    return subdomains.split('/')[0];  
}

function GetSianetURL(url) {
    return url ? `https://www.sianet.edu.pe/${ FirstSubdomainFromURLString(url) }/` : "https://www.sianet.edu.pe/your_school/";
}