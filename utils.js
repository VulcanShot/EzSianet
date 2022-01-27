function ParseSianetType(str) { // i.e.: _TAREA = Tarea
    let formattedString = str.substr(1, str.length);
    formattedString = formattedString.replaceAll(/_/g, ' ');
    return titleize(formattedString);
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
        return 'Yesterday';
    }
    if (date.getTime() === today.getTime()) {
        return 'Today';
    }
    if (date.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function ParseDateToInt(str) {
    return Date.parse(str);
}

function DateToTD(date, tdClass) { 
    let fontcolor = getComputedStyle(document.body).getPropertyValue('--main-color');
    
    let parsedDate = ParseDate(date);
    if (parsedDate === 'Today' || parsedDate === 'Tomorrow')
        return `<td class="${tdClass}" style="color: ${fontcolor};">` + parsedDate + '</td>'

    return `<td class="${tdClass}">` + parsedDate + '</td>'
}

function RemoveDiacritics(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}