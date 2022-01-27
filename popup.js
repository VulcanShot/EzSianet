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
    DisplayData(globalAssignments);
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

function DisplayData(assignemnts) {
    console.groupCollapsed('Assignments Table');
    console.table(assignemnts);
    console.groupEnd();

    if (assignemnts.length == 0) {
        ShowNoAssignemntsError();
        return;
    }
    
    for (let i = assignemnts.length - 1; i >= 0; i--) {
        if (new Date(assignemnts[i].end).getFullYear() !== new Date().getFullYear()) {
            assignemnts.splice(i, 1); 
            continue;
        }
        
        let repetitions = assignemnts.filter(x => x.id === assignemnts[i].id);
        if (repetitions.length === 2) {
            let startIndex = assignemnts.indexOf(repetitions[0]);
            let endIndex = assignemnts.indexOf(repetitions[1]);
            assignemnts[startIndex].end = repetitions[1].end;
            assignemnts.splice(endIndex, 1);
        }
    }

    if (assignemnts.length === 0) {
        $('#message-if-empty').css('width', $('#message-if-empty').outerWidth());
        $('#message-if-empty').show();
        $('#schedule').css('margin', '0px');
        $('#assignmentsTable').hide();
        $('#search').hide();
        return;
    }

    assignemnts.forEach((assignment) => {
        AddToTable(assignment);
    });

    ModalEventListeners();
    sortTable($('#assignmentsTable').get(0), 6, -1);
};

function ShowNoAssignemntsError() {
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
}

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
                k+= DateToTD(obj.start, 'start')
                k+= DateToTD(obj.end, 'end')
                k+= '<td class="more-info" data-modal-target="#modal">'
                k+=     '<button class="more-info-button">&plus;</button>'
                k+= '</td>'
                k+= `<td class="realEnd" style="display: none">${ParseDateToInt(obj.end)}</td>`
            k+= '</tr>';
        k+='</tbody>';
        
    document.getElementById('tableData').innerHTML += k;
}

function DateToTD(date, tdClass) { 
    let fontcolor = getComputedStyle(document.body).getPropertyValue('--main-color');
    
    let parsedDate = ParseDate(date);
    if (parsedDate === 'Today' || parsedDate === 'Tomorrow')
        return `<td class="${tdClass}" style="color: ${fontcolor};">` + parsedDate + '</td>'

    return `<td class="${tdClass}">` + parsedDate + '</td>'
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