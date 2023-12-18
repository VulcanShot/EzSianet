function ParseSianetSubject(str) {
    if (!str)
        return chrome.i18n.getMessage("no_subject_assignment");
    return titleize(str.trim());
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
    let today = new Date();
    let yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    let tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === yesterday.toDateString()) {
        return chrome.i18n.getMessage("yesterday");
    }
    if (date.toDateString() === today.toDateString()) {
        return chrome.i18n.getMessage("today");
    }
    if (date.toDateString() === tomorrow.toDateString()) {
        return chrome.i18n.getMessage("tomorrow");
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function DateToTD(date, classname) {
    let parsedDate = ParseDate(date);
    let cell = document.createElement('td');
    cell.innerText = parsedDate;
    cell.classList.add(classname);

    if (parsedDate === chrome.i18n.getMessage("today") || parsedDate === chrome.i18n.getMessage("tomorrow"))
        cell.classList.add('special')

    return cell;
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