$('#search').on('input', function(event) { // On key pressed while search bar is focused
    let query = RemoveDiacritics(event.target.value);
    $('#tableData td.title').each((index, td) => { // Each assignment
        let queryRegex = new RegExp(query, 'i');
        let normalizedColumnTitle = RemoveDiacritics(td.innerText);
        let tr = $(td).parent();
        if (queryRegex.test(normalizedColumnTitle)) { // If search matches
            tr.css('display', 'table-row');
        } else {
            tr.css('display', 'none');
        }
    });
    $('#assignmentsTable tr').css('background-color', 'initial');
    ChangeEvenRowColor();
});

function RemoveDiacritics(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

$('#schedule').click(function() { // Open schedule link
    chrome.storage.sync.get('schedule', (result) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        window.open(result.schedule, '_blank');
    });
});

$('#logo').click(function(evt) {
    $(document.body).toggleClass('dark');
    if ($(document.body).hasClass('dark')) { 
        chrome.storage.local.set({theme : 'dark'})
        evt.target.src = '/icons/icon_dark.png';
        return;
    }
    chrome.storage.local.set({theme : 'light'})
    evt.target.src = '/icons/icon_32.png';
});

let globalAssignments;
let removeOverlay = true;
Main();

async function Main() {
    SetTheme();
    ShowFirstTimeMessage();
    globalAssignments = await UpdateAll().then(items => { return items; })
    initStorageCache(globalAssignments);
    StopLoading();
    ChangeEvenRowColor();
}

function SetTheme() {
    chrome.storage.local.get('theme', (result) => {
        if (result.theme !== 'dark') return
        $(document.body).toggleClass('dark');
        $('#logo').attr('src', '/icons/icon_dark.png');
    });
}

function ShowFirstTimeMessage() {
    chrome.storage.local.get('isFirstTime', (result) => {
        if (result.isFirstTime !== true) return
        HideLoader();
        ShowAnnouncement(
            'Welcome to EzSianet',
            `<p>Follow the instructions below to quickly set all things up:</p>
             <p>1. Visit your school's SiaNet webpage (i.e: https://www.sianet.edu.pe/your_school/)
             <br>2. Open your calendar and schedule on the website
             <br>3. Enjoy the extension!
             <br>Remember that the information is updated automatically</p>
             <br>You can toggle between light and dark UI modes by clicking on the logo.`
        );
    });
    chrome.storage.local.set({'isFirstTime': false});
}

function AddDummyRow() {
    let k = '<tbody>'
            k+= `<tr>`;
                k+= '<td class="title"></td>'
                k+= '<td class="subject"></td>'
                k+= '<td class="type"></td>'
                k+= '<td class="start"></td>'
                k+= '<td class="end"></td>'
                k+= '<td class="more-info">'
                k+=     '<button class="more-info-button"></button>'
                k+= '</td>'
                k+= `<td class="realEnd" style="display: none"></td>`
            k+= '</tr>';
        k+='</tbody>';
        
    document.getElementById('tableData').innerHTML += k;
}

function DisplayDummyTable() {
    for (let index = 0; index <= 4; index++) {
        AddDummyRow();
    }
}

function initStorageCache(items) {
    console.groupCollapsed('Assignments Table');
    console.table(items);
    console.groupEnd();

    if (items.length == 0) {
        chrome.storage.sync.get('link', (result) => {
            let subdomains = new URL(result.link).pathname;
            subdomains = subdomains.substring(1);
            let firstSubdomain = subdomains.split('/')[0];
            let sianetURL = `https://www.sianet.edu.pe/${firstSubdomain}/`;
            ShowAnnouncement(
                'There was an error :C',
                `<p>Please follow the instructions below:</p>
                <p><b>1.</b> Visit your school's SiaNet webpage (<a href="${sianetURL}" target="_blank">${sianetURL}</a>)
                <br><b>2.</b> Open your calendar and schedule on the website
                <br><br>If the error persists, there is probably an issue with Sianet servers. Feel free to contact me through Discord: Vulcan#2944</p>`
            );
        });
        removeOverlay = false;
        $('#overlay').off('click');
        $('[data-close-button]').hide();
        return;
    }
    
    for (let i = items.length - 1; i >= 0; i--) {
        let assignment = items[i];
        if (new Date(assignment.end).getFullYear() !== new Date().getFullYear()) {
            delete items[i]; 
            continue;
        }
        let repetitions = items.filter(x => x.id === assignment.id);
        if (repetitions.length === 2) {
            let startIndex = items.indexOf(repetitions[0]);
            let endIndex = items.indexOf(repetitions[1]);
            items[startIndex].end = repetitions[1].end;
            delete items[endIndex];
        }
    }

    items.forEach((assignment) => {
        AddToTable(assignment);
    });

    ModalEventListeners();
    sortTable($('#assignmentsTable').get(0), 6, -1);
};

function StopLoading() {
    HideLoader();
    if (removeOverlay) {
        $('#overlay').removeClass('active');
    }
}

function HideLoader() { $('#loader').css('display', 'none'); }

function ChangeEvenRowColor() {
    $('#assignmentsTable tr').filter(function() {
        return $(this).css('display') === 'table-row';
    }).even().css('background-color', 'var(--table-secondary-color)');
}

async function UpdateAll() {
    let data;
    let link;
    function setData(dt) {
        data = dt;
    }
    function setLink(_link) {
        link = _link;
    }
    let attributesToDelete = [  
        'objModelo', 'stColor', 'stCurso', 'stFechaLeido', 'stFechaRespuesta', 'stIdActividadAcademica', 'stIdAlumno', 'stIdCursoAsignacion', 
        'stMensaje', 'stNombreTablaInterno', 'stTipoAsistencia', 'stTipoAsistenciaDescripcion', 'stToolTip', 'stFechaFin', 'color_c', 'boVisto', 
        'AsignadoPor', 'inIdAlumnoCicloLectivo', 'inIdPersona', 'boVencido', 'boRespondido', 'boExito', 'boEsInicio', 'boCalificado', 'boBloqueado', 
        'allDay', 'stDescripcionMotivo' ]

    await RefreshLink().then(link => { setLink(link) })
    await fetch(link)
        .then(response => response.json())
        .then(json => setData(json))
        .then(() => {
            data.forEach(assignment => {
                attributesToDelete.forEach(attribute => {
                    delete assignment[attribute];
                });
            });
        })
        .catch(error => console.error(error))
    return await Promise.resolve(data);
}

function RefreshLink() { // Return an updated link in promise
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('link', (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            let updatedLink = new URL(result.link);
            updatedLink.searchParams.set('end', encodeURI(new Date().toISOString()));
            chrome.storage.sync.set({link: updatedLink.href});
            console.log('URL: ' + updatedLink.href)
            resolve(updatedLink.href);
        });
    });
}

function AddToTable(obj) {
    let k = '<tbody>'
            k+= `<tr class="${obj.id}">`;
                k+= '<td class="title">' + obj.title + '</td>'
                k+= '<td class="subject">' + titleize(obj.DescripcionCurso) + '</td>'
                k+= '<td class="type">' + ParseSianetType(obj.tipo) + '</td>'
                k+= '<td class="start">' + ParseDate(obj.start) + '</td>'
                k+= '<td class="end">' + ParseDate(obj.end); + '</td>'
                k+= '<td class="more-info" data-modal-target="#modal">'
                k+=     '<button class="more-info-button">&plus;</button>'
                k+= '</td>'
                k+= `<td class="realEnd" style="display: none">${ParseDateToInt(obj.end)}</td>`
            k+= '</tr>';
        k+='</tbody>';
        
    document.getElementById('tableData').innerHTML += k;
}

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
    
    let fontcolor = getComputedStyle(document.body).getPropertyValue('--main-color');
    if (date.toString() == yesterday.toString()) {
        return 'Yesterday';
    }
    if (date.toString() == today.toString()) {
        return 'Today'.fontcolor(fontcolor);
    }
    if (date.toString() == tomorrow.toString()) {
        return 'Tomorrow'.fontcolor(fontcolor);
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function ParseDateToInt(str) {
    return Date.parse(str);
}

// MODAL

function ModalEventListeners() {
    $('[data-modal-target]').each((index, button) => {
        $(button).click(() => {
            const assignmentId = button.parentElement.className;
            let selectedAssignment = globalAssignments.find(assigned => assigned.id === assignmentId);
            SetModalTitle(selectedAssignment.title);
            let body = selectedAssignment.stDescripcionInterna;
            SetModalBody(body);
            const modal = document.querySelector(button.dataset.modalTarget);
            modal.classList.remove('announcement');
            openModal(modal);
        })
    })

    $('[data-close-button]').each((index, button) => {
        $(button).click((event) => {
            const modal = event.target.closest('.modal');
            closeModal(modal);
        })
    })
}

$('#overlay').click(() => {
    $('.modal.active').each((index, modal) => {
        closeModal(modal);
    })
})

function openModal(modal) {
    if (modal == null) return
    modal.classList.add('active');
    $('#overlay').addClass('active');
}

function closeModal(modal) {
    if (modal == null) return
    modal.classList.remove('active');
    $('#overlay').removeClass('active');
}

function SetModalTitle(title) {
    $('#popup-title').text(title);
}

function SetModalBody(body) {
    $('#popup-body').html(body);
}  

function ShowAnnouncement(title, body) { 
    DisplayDummyTable();
    SetModalTitle(title);
    SetModalBody(body);
    $('#modal').addClass('announcement');
    openModal(modal);
    ModalEventListeners();
}