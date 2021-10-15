document.getElementById('search').addEventListener('keyup', function(event) { // On key pressed while search bar is focused
    let query = event.target.value;
    document.getElementById('tableData').childNodes.forEach((tr) => { // Each assignment
        tr.childNodes.forEach((td) => { // Each column
            if (td.className == 'title') {
                let regex = new RegExp(query, 'i');
                let normalizedColumnTitle = td.innerText.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Ignore accents/diacritics
                if (regex.test(normalizedColumnTitle)) { // If search matches
                    tr.style.display = ''
                } else {
                    tr.style.display = 'none'
                }
            }
        });
    });
});

document.getElementById('schedule').addEventListener('click', function() { // Open schedule link
    chrome.storage.sync.get('schedule', (link) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        window.open(link.schedule, '_blank');
    });
});

document.getElementById('logo').addEventListener('click', function(evt) {
    document.body.classList.toggle('dark')
    if (document.body.matches('.dark')) { 
        chrome.storage.local.set({theme : 'dark'})
        evt.target.src = '/icons/icon_dark.png';
        return;
    }
    chrome.storage.local.set({theme : 'light'})
    evt.target.src = '/icons/icon_32.png';
});

let globalAssignments;
const overlay = document.getElementById('overlay')
Main();

async function Main() {
    SetTheme();
    ShowFirstTimeMessage();
    globalAssignments = await UpdateAll().then(items => { return items; })
    await initStorageCache(globalAssignments);
    StopLoading();
}

function SetTheme() {
    chrome.storage.local.get('theme', (theme) => {
        if (theme.theme !== 'dark') return
        document.body.classList.add('dark');
        document.getElementById('logo').src = '/icons/icon_dark.png';
    });
}

function ShowFirstTimeMessage() {
    chrome.storage.local.get('isFirstTime', (obj) => {
        if (obj.isFirstTime !== true) return
        SetModalTitle('Welcome to EzSianet');
        SetModalBody(
            `<p>Follow the instructions below to quickly set all things up:</p>
            <p>1. Visit your school's SiaNet webpage (i.e: https://www.sianet.edu.pe/your_school/)
            <br>2. Open your calendar and schedule on the website
            <br>3. Enjoy the extension!
            <br>Remember that the information is updated automatically</p>`
            )
        const modal = document.getElementById('modal');
        modal.classList.add('announcement');
        openModal(modal);
        StopLoading();
    });
    chrome.storage.local.set({'isFirstTime': false});
}

let repeated = []; // ID's from repeated assignments
async function initStorageCache(items) {
    console.log(items);
    let length = Object.keys(items).length;
    let allIds = [];

    items.forEach(element => {
        allIds.push(element.id);
    });
    
    for (let i = length - 1; i >= 0; i--) {
        var assignment = items[i];
        if (IsRepeated(allIds, assignment.id)) {
            repeated.push(assignment.id);
        }
        AddToTable(assignment);
    }

    if (repeated.length % 2 == 0) { repeated.length /= 2 }
    
    repeated.forEach((id) => {
        var endElem = document.getElementsByClassName(id)[0]; // Second element to be added, contains true END date
        var startElem = document.getElementsByClassName(id)[1]; // First element to be added, contains true START date 
        endElem.childNodes[3].innerText = startElem.childNodes[3].innerText; // Change starting date
        startElem.remove();
    });

    ModalEventListeners();
    var table = document.getElementById('assignmentsTable');
    sortTable(table, 6, -1);
};

function StopLoading() {
    const loader = document.getElementById('loader');
    loader.style.display = 'none';
    overlay.classList.remove('active');
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
    let attributesToDelete = ['objModelo', 'stColor', 'stCurso', 'stFechaLeido', 'stFechaRespuesta', 'stIdActividadAcademica', 'stIdAlumno', 'stIdCursoAsignacion', 'stMensaje', 'stNombreTablaInterno', 'stTipoAsistencia', 'stTipoAsistenciaDescripcion', 'stToolTip', 'stFechaFin', 'color_c', 'boVisto', 'AsignadoPor', 'inIdAlumnoCicloLectivo', 'inIdPersona', 'boVencido', 'boRespondido', 'boExito', 'boEsInicio', 'boCalificado', 'boBloqueado', 'allDay' ]
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
            resolve(updatedLink.href);
        });
    });
}

function IsRepeated(arr, id) {
    var count = 0;
    arr.forEach((_id) => {
        if (_id === id) {
            count++;
        }
    });
    if (count > 1) { return true; }
    return false;
}

function AnimateAndReset(id, animClass, ms) { // Add animation class and remove it after ms miliseconds
    var refresh = document.getElementById(id);
    refresh.classList.add(animClass);
    setTimeout(() => {
        refresh.classList.remove(animClass);
    }, ms);
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
    
    if (date.toString() == yesterday.toString()) {
        return 'Yesterday';
    }
    if (date.toString() == today.toString()) {
        return 'Today';
    }
    if (date.toString() == tomorrow.toString()) {
        let fontcolor = getComputedStyle(document.body).getPropertyValue('--main-color');
        return 'Tomorrow'.fontcolor(fontcolor);
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function ParseDateToInt(str) {
    return Date.parse(str);
}

// MODAL

function ModalEventListeners() {
    const openModalButtons = document.querySelectorAll('[data-modal-target]')
    const closeModalButtons = document.querySelectorAll('[data-close-button]')

    openModalButtons.forEach(button => {
        button.addEventListener('click', () => {
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

    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            closeModal(modal);
        })
    })
}

overlay.addEventListener('click', () => {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
        closeModal(modal);
    })
})

function openModal(modal) {
    if (modal == null) return
    modal.classList.add('active');
    overlay.classList.add('active');
}

function closeModal(modal) {
    if (modal == null) return
    modal.classList.remove('active');
    overlay.classList.remove('active');
}

function SetModalTitle(title) {
    const modalTitle = document.getElementById('popup-title');
    modalTitle.innerText = title;
}

function SetModalBody(body) {
    const modalBody = document.getElementById('popup-body');
    modalBody.innerHTML = body;
}   