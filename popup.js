$('#search').on('input', function(event) { // On key pressed while search bar is focused
    let query = NormalizeDiactitics(event.target.value);
    $('#tableData td').each((index, td) => { // Each assignment
        if (td.className == 'title') {
            let queryRegex = new RegExp(query, 'i');
            let normalizedColumnTitle = NormalizeDiactitics(td.innerText);
            let tr = $(td).parent();
            if (queryRegex.test(normalizedColumnTitle)) { // If search matches
                tr.css('display', 'table-row');
            } else {
                tr.css('display', 'none');
            }
        }
    });
    ChangeEvenRowColor();
});

function NormalizeDiactitics(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

$('#schedule').click(function() { // Open schedule link
    chrome.storage.sync.get('schedule', (link) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        window.open(link.schedule, '_blank');
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

let removeOverlay = true;
Main();

async function Main() {
    SetTheme();
    ShowFirstTimeMessage();
    await UpdateAll().then(async (items) => { await initStorageCache(items); })
    StopLoading();
    ChangeEvenRowColor();
}

function SetTheme() {
    chrome.storage.local.get('theme', (theme) => {
        if (theme.theme !== 'dark') return
        $(document.body).toggleClass('dark');
        $('#logo').attr('src', '/icons/icon_dark.png');
    });
}

function ShowFirstTimeMessage() {
    chrome.storage.local.get('isFirstTime', (obj) => {
        if (obj.isFirstTime !== true) return
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

async function initStorageCache(items) {
    // console.groupCollapsed('Assignments Table');
    // console.table(items);
    // console.groupEnd();
    let length = Object.keys(items).length;

    if (items.length == 0) {
        ShowAnnouncement(
            'There was an error :C',
            `<p>Please follow the instructions below:</p>
            <p><b>1.</b> Visit your school's SiaNet webpage (i.e: https://www.sianet.edu.pe/your_school/)
            <br><b>2.</b> Open your calendar and schedule on the website
            <br><br>If the error persists, there is probably an issue with Sianet servers. Feel free to contact me through Discord: Vulcan#2944</p>`
        );
        removeOverlay = false;
        $('#overlay').off('click');
        $('[data-close-button]').hide();
        return;
    }
    
    let repeatedIds = [];
    for (let i = length - 1; i >= 0; i--) {
        var assignment = items[i];
        if (IsIdRepeated(items, assignment.id)) {
            repeatedIds.push(assignment.id);
        }
        if (new Date(assignment.end).getFullYear() !== new Date().getFullYear()) {
            continue;
        }
        AddToTable(assignment);
    }

    if (repeatedIds.length % 2 == 0) { repeatedIds.length /= 2 }
    
    repeatedIds.forEach((assignmentId) => {
        var endElem = $('.' + assignmentId).eq(0); // Second element to be added, contains true END date
        var startElem = $('.' + assignmentId).eq(1); // First element to be added, contains true START date 
        endElem.children('.start').text(startElem.children('.start').text()); // Change starting date
        startElem.remove();
    });

    ModalEventListeners();
    sortTable($('#assignmentsTable').get(0), 6, -1);
};

function IsIdRepeated(arr, val) {
    var count = 0;
    arr.forEach((assignment) => {
        if (assignment.id === val) {
            count++;
        }
    });
    if (count > 1) { return true; }
    return false;
}

function StopLoading() {
    HideLoader();
    if (removeOverlay) {
        $('#overlay').removeClass('active');
    }
}

function HideLoader() { $('#loader').css('display', 'none'); }

function ChangeEvenRowColor() {
    $('#assignmentsTable tr').css('background-color', 'initial');
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
            data.forEach(assignment => { // For each assignment
                attributesToDelete.forEach(attribute => { // For each attribute on attributesToDelete
                    delete assignment[attribute]; // Delete attributes
                });
            });
        })
        .catch(error => console.error(error))
    return await Promise.resolve(data);
}

function RefreshLink() { // Return an updated link in promise
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('link', (link) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            let updatedLink = new URL(link.link);
            updatedLink.searchParams.set('end', encodeURI(new Date().toISOString()));
            chrome.storage.sync.set({link: updatedLink.href});
            console.log(updatedLink.href)
            resolve(updatedLink.href);
        });
    });
}

function AddToTable(obj) { // Add obj to table
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