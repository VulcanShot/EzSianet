let globalAssignments;
let removeOverlay = true;
let storage = {};

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

$('#schedule').click(function() {
    window.open(storage.schedule, '_blank');
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

(async function() {
    SetTheme();
    ShowFirstTimeMessage();
    await GetDataFromStorage().then(itemsFromChrome => {
        Object.assign(storage, itemsFromChrome)
    });
    globalAssignments = await UpdateAll().then(items => { return items; })
    DisplayData(globalAssignments);
    StopLoading();
    ChangeEvenRowColor();
})();

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

async function GetDataFromStorage() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}

async function UpdateAll() {
    let data;
    function setData(dt) {
        data = dt;
    }
    let attributesToDelete = [ 'objModelo', 'stColor', 'stCurso', 'stFechaLeido', 'stFechaRespuesta', 'stIdActividadAcademica', 'stIdAlumno', 
        'stIdCursoAsignacion','stMensaje', 'stNombreTablaInterno', 'stTipoAsistencia', 'stTipoAsistenciaDescripcion', 'stToolTip', 'stFechaFin', 'color_c', 
        'boVisto', 'AsignadoPor', 'inIdAlumnoCicloLectivo', 'inIdPersona', 'boVencido', 'boRespondido', 'boExito', 'boEsInicio', 'boCalificado', 'boBloqueado', 
        'allDay', 'stDescripcionMotivo' ];
    
    let updatedLink = new URL(storage.link);
    updatedLink.searchParams.set('end', encodeURI(new Date().toISOString()));
    storage.link = updatedLink.href;

    await fetch(storage.link)
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

function AddToTable(obj) {
    let k =  `<tr class="${obj.id}">
                    <td class="title"> ${obj.title} </td>
                    <td class="subject"> ${titleize(obj.DescripcionCurso)} </td>
                    <td class="type"> ${ParseSianetType(obj.tipo)} </td>
                    ${ DateToTD(obj.start, 'start') }
                    ${ DateToTD(obj.end, 'end') }
                    <td class="more-info" data-modal-target="#modal">
                        <button class="more-info-button">&plus;</button>
                    </td>
                    <td class="realEnd" style="display: none">${ParseDateToInt(obj.end)}</td>
            </tr>`;
        
    $('#tableData').append(k);
}

function StopLoading() {
    HideLoader();
    if (removeOverlay) {
        $('#overlay').removeClass('active');
    }
}

function ChangeEvenRowColor() {
    $('#assignmentsTable tr').filter(function() {
        return $(this).css('display') === 'table-row';
    }).even().css('background-color', 'var(--table-secondary-color)');
}

function HideLoader() { $('#loader').css('display', 'none'); }

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
    $('.modal-title').text(title);
}

function SetModalBody(body) {
    $('.modal-body').html(body);
}  

function ShowAnnouncement(title, body) { 
    DisplayDummyTable();
    SetModalTitle(title);
    SetModalBody(body);
    $('#modal').addClass('announcement');
    openModal(modal);
    ModalEventListeners();
}

function DisplayDummyTable() {
    for (let index = 0; index <= 4; index++) {
        AddDummyRow();
    }
}

function AddDummyRow() {
    let k = `<tr>
                <td class="title"></td>
                <td class="subject"></td>
                <td class="type"></td>
                <td class="start"></td>
                <td class="end"></td>
                <td class="more-info">
                   <button class="more-info-button"></button>
                </td>
                <td class="realEnd" style="display: none"></td>
            </tr>`
        
    $('#tableData').append(k);
}