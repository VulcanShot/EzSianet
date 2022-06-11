let removeOverlay = true;
const storage = {};
const ASSIGNMENTS_PER_LOAD = 50;

$('#search').on('input', function(event) { // On key pressed while search bar is focused
    let query = RemoveDiacritics(event.target.value);
    $('body table tbody td.title').each((index, td) => { // Each assignment
        let queryRegex = new RegExp(query, 'i');
        let normalizedColumnTitle = RemoveDiacritics(td.innerText);
        let tr = $(td).parent();
        if (queryRegex.test(normalizedColumnTitle)) { // If search matches
            tr.css('display', 'table-row');
        } else {
            tr.css('display', 'none');
        }
    });
    $('body table tr').css('background-color', 'initial');
    ChangeEvenRowColor();
});

$('#schedule').click(function() {
    if (storage.schedule === undefined) {
        ShowScheduleErrorModal();
        return;
    }
    window.open(storage.schedule, '_blank');
});

function ShowScheduleErrorModal() {
    chrome.storage.sync.get('link', (result) => {
        let sianetURL = GetSianetURL(result.link);
        ShowAnnouncement(
            chrome.i18n.getMessage("schedule_error_modal_title"),
            `<p>${chrome.i18n.getMessage("generic_modal_1")}</p>
            <p><b>1.</b> ${chrome.i18n.getMessage("generic_modal_2")} (<a href="${sianetURL}" target="_blank">${sianetURL}</a>)
            <br><b>2.</b> ${chrome.i18n.getMessage("schedule_error_modal_1")}
            <br><br>${chrome.i18n.getMessage("schedule_error_modal_2")} Vulcan#2944</p>`
        );
    });
}

$('#mode').click(function() {
    $(document.body).toggleClass('dark');
    if ($(document.body).hasClass('dark')) { 
        chrome.storage.local.set({theme : 'dark'})
        return;
    }
    chrome.storage.local.set({theme : 'light'})
});

$('#logo').click(function() {
    if (storage.link === undefined) {
        ShowErrorModal();
        return;
    }
    window.open(GetSianetURL(storage.link) + 'Home/Index', '_blank');
});

$('.modal').scroll(function() {
    
    var scrollTop = $(this).scrollTop();

    $('.modal-header').css({
        opacity: function() {
            var elementHeight = $(this).height(),
            opacity = ((elementHeight - scrollTop) / elementHeight);
            return opacity;
        }
    });

});

$('#load-more').click(() => {
    let shown = [];

    for (let index = storage.hiddenAssignments.length - 1; index >= 0; index--) {
        const assignment = storage.hiddenAssignments[index];

        if (index >= storage.hiddenAssignments.length - ASSIGNMENTS_PER_LOAD) {
            AddToTable(assignment);
            shown.push(assignment.id);
            continue;
        }
    }

    storage.hiddenAssignments = storage.hiddenAssignments.filter((assignment) => {
        return shown.indexOf(assignment.id) === -1;
    });

    if (storage.hiddenAssignments.length === 0)
        $('#load-more').hide();
});

(async function() {
    SetTheme();
    ShowFirstTimeMessage();
    await GetDataFromStorage().then(itemsFromChrome => {
        Object.assign(storage, itemsFromChrome)
    });
    storage.assignments = await FetchData().then(items => { return items; })
    DisplayData();
    StopLoading();
    ChangeEvenRowColor();
})();

function SetTheme() {
    chrome.storage.local.get('theme', (result) => {
        if (result.theme !== 'dark') return;
        $(document.body).toggleClass('dark');
    });
}

function ShowFirstTimeMessage() {
    chrome.storage.local.get('isFirstTime', (result) => {
        if (result.isFirstTime !== true) return
        HideLoader();
        ShowAnnouncement(
            chrome.i18n.getMessage("welcome_modal_title"),
            `<p>${chrome.i18n.getMessage("welcome_modal_1")}</p>
             <p>1. ${chrome.i18n.getMessage("generic_modal_2")} ${chrome.i18n.getMessage("default_url")}
             <br>2. ${chrome.i18n.getMessage("generic_modal_3")}
             <br>3. ${chrome.i18n.getMessage("welcome_modal_2")}</p>
             <br>${chrome.i18n.getMessage("welcome_modal_3")}`
        );
        DisplayDummyTable()
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

async function FetchData() {
    let data;
    
    function setData(dt) {
        data = dt;
    }

    let attributesToDelete = [ 'objModelo', 'stColor', 'stCurso', 'stFechaLeido', 'stFechaRespuesta', 'stIdActividadAcademica', 'stIdAlumno', 
        'stIdCursoAsignacion','stMensaje', 'stNombreTablaInterno', 'stTipoAsistencia', 'stTipoAsistenciaDescripcion', 'stToolTip', 'stFechaFin', 'color_c', 
        'boVisto', 'AsignadoPor', 'inIdAlumnoCicloLectivo', 'inIdPersona', 'boVencido', 'boRespondido', 'boExito', 'boEsInicio', 'boCalificado', 'boBloqueado', 
        'allDay', 'stDescripcionMotivo' ];

    if (storage.link === undefined) {
        ShowErrorModal();
        return await Promise.reject('There is no data URL');
    }
    
    let updatedLink = new URL(storage.link);
    updatedLink.searchParams.set('start', encodeURI(new Date(2010).toISOString()));
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
    return await Promise.resolve(data);
}

function DisplayData() {
    console.groupCollapsed('Assignments Table');
    console.log("Source: " + storage.link);
    console.table(storage.assignments);
    console.groupEnd();

    if (storage.assignments.length === 0 && storage.backup) {
        storage.backup.forEach((assignment) => {
            AddToTable(assignment);
        });
        ShowNetworkErrorModal();
        return;
    }

    if (storage.assignments.length === 0) {
        ShowErrorModal();
        return;
    }
    
    for (let i = storage.assignments.length - 1; i >= 0; i--) { // Remove repeated assignments
        let repetitions = storage.assignments.filter(x => x.id === storage.assignments[i].id);
        if (repetitions.length !== 2) continue;

        let startIndex = storage.assignments.indexOf(repetitions[0]);
        let endIndex = storage.assignments.indexOf(repetitions[1]);
        storage.assignments[startIndex].end = repetitions[1].end;
        storage.assignments.splice(endIndex, 1);
    }

    if (storage.assignments.length === 0) {
        $('#message-if-empty').css('width', $('#message-if-empty').outerWidth());
        $('#message-if-empty').show();
        $('#schedule').css('margin', '0px');
        $('body table').hide();
        $('#search').hide();
        return;
    }

    let backup = [];

    for (let index = storage.assignments.length - 1; index >= 0; index--) {
        const assignment = storage.assignments[index];

        if (assignment.end > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            backup.push(assignment);

        if (index >= storage.assignments.length - ASSIGNMENTS_PER_LOAD) {
            AddToTable(assignment);
            continue;
        }

        if (!storage.hiddenAssignments)
            storage.hiddenAssignments = [];

        storage.hiddenAssignments.push(assignment);
        $("#load-more").css('display', 'block');
    }

    SetUpBackup(backup);
    ModalEventListeners();
    sortTable($('body table').get(0), 5, -1);
};

function SetUpBackup(arr) {
    if (storage.backup && !ArraysAreEqual(arr, storage.backup))
        chrome.storage.sync.set({backup: arr});
}

function ArraysAreEqual(array1, array2) {
    const array2Sorted = array2.slice().sort();
    return array1.length === array2.length && array1.slice().sort().every(function(value, index) {
        return value === array2Sorted[index];
    });
}

function ShowErrorModal() {
    chrome.storage.sync.get('link', (result) => {
        let sianetURL = GetSianetURL(result.link);

        ShowAnnouncement(
            chrome.i18n.getMessage("assignments_error_modal_title"),
            `<p>${chrome.i18n.getMessage("generic_modal_1")}</p>
            <p><b>1.</b> ${chrome.i18n.getMessage("generic_modal_2")} (<a href="${sianetURL}" target="_blank">${sianetURL}</a>)
            <br><b>2.</b> ${chrome.i18n.getMessage("generic_modal_3")}
            <br><br>${chrome.i18n.getMessage("assignments_error_modal_1")} Vulcan#2944</p>`
        );
    });
    $('#overlay').off('click');
    $('[data-close-button]').hide();
    DisplayDummyTable()
}

function ShowNetworkErrorModal() {
    chrome.storage.sync.get('link', (result) => {
        let sianetURL = GetSianetURL(result.link);
        
        ShowAnnouncement(
            chrome.i18n.getMessage("assignments_error_modal_title"),
            `<p>${chrome.i18n.getMessage("network_error_modal_1")}</p>
            <p>${chrome.i18n.getMessage("network_error_modal_2")}</p>
            <p><b>1.</b> ${chrome.i18n.getMessage("generic_modal_2")} (<a href="${sianetURL}" target="_blank">${sianetURL}</a>)
            <br><b>2.</b> ${chrome.i18n.getMessage("generic_modal_3")}
            <br><br>${chrome.i18n.getMessage("assignments_error_modal_1")} Vulcan#2944</p>`
        );
    });
    $('#overlay').off('click');
}

function AddToTable(obj) {
    let k =  `<tr class="${obj.id}">
                    <td class="title"> ${obj.title.trim()} </td>
                    <td class="subject"> ${ ParseSianetSubject(obj.DescripcionCurso) } </td>
                    <td class="type"> ${ ParseSianetType(obj.tipo) } </td>
                    ${ DateToTD(obj.start, 'start') }
                    ${ DateToTD(obj.end, 'end') }
                    <td class="real-end">${ Date.parse(obj.end) }</td>
                    <td class="more-info" data-modal-target="#modal">
                        <button class="more-info-button">&plus;</button>
                    </td>
            </tr>`;
        
    $('body table tbody').append(k);
}

function StopLoading() {
    HideLoader();
    if (removeOverlay) {
        $('#overlay').removeClass('active');
    }
}

function ChangeEvenRowColor() {
    $('body table tr').filter(function() {
        return $(this).css('display') === 'table-row';
    }).even().css('background-color', 'var(--table-secondary-color)');
}

function HideLoader() { $('#loader').css('display', 'none'); }

// MODAL

function ModalEventListeners() {
    $('[data-modal-target]').each((index, button) => {
        $(button).click(() => {
            const assignmentId = button.parentElement.className;
            let selectedAssignment = storage.assignments.find(assigned => assigned.id === assignmentId);
            SetModalTitle(selectedAssignment.title);
            SetModalBody(selectedAssignment.stDescripcionInterna);
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
    SetModalTitle(title);
    SetModalBody(body);
    $('#modal').addClass('announcement');
    openModal(modal);
    ModalEventListeners();
    removeOverlay = false;
}

function DisplayDummyTable() {
    for (let index = 0; index <= 4; index++) {
        AddDummyRow();
    }
    ChangeEvenRowColor();
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
        
    $('body table tbody').append(k);
}