document.getElementById('search').addEventListener('keyup', function(event) { // On key pressed while search bar is focused
    let query = event.target.value;
    console.log(query);
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

let repeated = []; // ID's from repeated assignments
const initStorageCache = getAllStorageSyncData().then(items => {
    console.log(items);
    let length = items.length;
    let assignments = []; //All ID's

    GetOnlyAssignmentsIdFromArray(items, assignments);
    
    for (let index = length - 1; index >= 0; index--) {
        var assignment = items[index];
        try {
            if (IsRepeated(assignments, assignment.id)) {
                repeated.push(assignment.id);
            }
            AddToTable(assignment);
        } catch (error) {
            console.warn('Error at item ', index, ':', error);
        }
    }
}).then(() => {
    if (repeated.length % 2 == 0) { repeated.length /= 2 }
    try {
        repeated.forEach((id) => {
            var endElem = document.getElementsByClassName(id)[0]; // Second element to be added, contains true END date
            var startElem = document.getElementsByClassName(id)[1]; // First element to be added, contains true START date 
            endElem.childNodes[3].innerText = startElem.childNodes[3].innerText; // Chanege starting date
            startElem.remove();
        });
    } catch (error) {
        console.warn('Error deleting repeated elements: ', error);
    }

    try {
        PopupEventListeners();
    } catch (error) {
        console.warn('Error adding event listeners to buttons: ', error);
    }
    
    var table = document.getElementById('assignmentsTable');
    sortTable(table, 6, -1);
});

Main(); // Entry Point

async function Main() {
    UpdateOnTimeElapsed();
    initStorageCache;
    if (IsTableEmpty() === true) {
        chrome.storage.sync.set({'last-time-fetch': 0}); // Reset fetch timeout
    }
    UpdateOnTimeElapsed();
}

async function UpdateOnTimeElapsed() {
    if (await IsFetchTimeoutElapsed() === true) {
        UpdateAll();
    }
}

function IsFetchTimeoutElapsed() {
    const now = Date.now();
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('last-time-fetch', (ltf) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            const lastTimeFetch = ltf['last-time-fetch'];
            if ((lastTimeFetch + 60000) > now) { return resolve(false); } // False if timeout has not elapsed
            chrome.storage.sync.set({'last-time-fetch': now});
            resolve(true);
        });
    });
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
    fetch(link)
        .then(response => response.json()).then( json => setData(json))
        .catch(error => console.error(error))
        .finally(() => {
            data.forEach(assignment => { // For each assignment
                attributesToDelete.forEach(attribute => { // For each attribute on array
                    delete assignment[attribute]; // Delete attributes
                });
            });
            
            for (let index = 0; index < data.length; index++) {
                if (data[index].stDescripcionInterna.length > 5500) {
                    // Remove all html tags if text is too long
                    var rawHtml = data[index].stDescripcionInterna;
                    var div = document.createElement("div");
                    div.innerHTML = rawHtml;
                    data[index].stDescripcionInterna = div.textContent || div.innerText || "Description is too long.";
                    div.remove();
                    console.log(`${index}th description was too long`);
                }
                chrome.storage.sync.set({[index.toString()]: data[index] }, function() {
                    if (chrome.runtime.lastError) {
                        console.log('Error updating assignments');
                    }
                    console.log(`${index} Calendar updated: `, data[index]);
                });
            }
            chrome.storage.sync.set({'length' : data.length});
        }
    );
}

function IsTableEmpty() {
    return new Promise((resolve, reject) => {
        if (document.getElementById('tableData').childNodes.length < 1) { return resolve(true); }
        resolve(false);
    });
}

function getAllStorageSyncData() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, (items) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(items);
        });
    });
}

function GetOnlyAssignmentsIdFromArray(inArr, outArr) {
    for (var key in inArr) {
        if (/\d/.test(key)) {
            outArr.push(inArr[key].id)
        }
    }
}

function GetOnlyAssignmentsFromArray(inArr, outArr) {
    for (var key in inArr) {
        if (/\d/.test(key)) {
            outArr.push(inArr[key])
        }
    }
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
    try {
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
    }
    catch (ex) {
        console.warn('Error adding to table: ', ex);
    }
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
        return 'Tomorrow'.fontcolor('red');
    }

    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function ParseDateToInt(str) {
    return Date.parse(str);
}

// POPUP

function PopupEventListeners() {
    const openModalButtons = document.querySelectorAll('[data-modal-target]')
    const closeModalButtons = document.querySelectorAll('[data-close-button]')

    openModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const assignmentId = button.parentElement.className;
            getAllStorageSyncData().then(items => {
                let assignments = [];
                GetOnlyAssignmentsFromArray(items, assignments);
                let selectedAssignment = assignments.find(assigned => assigned.id === assignmentId);
                SetModalTitle(selectedAssignment.title);
                let body = 
                `${selectedAssignment.stDescripcionInterna}`;
                SetModalBody(body);
            });
            const modal = document.querySelector(button.dataset.modalTarget)
            openModal(modal)
        })
    })

    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal')
            closeModal(modal)
        })
    })
}

const overlay = document.getElementById('overlay')
overlay.addEventListener('click', () => {
    const modals = document.querySelectorAll('.modal.active')
    modals.forEach(modal => {
        closeModal(modal)
    })
})

function openModal(modal) {
  if (modal == null) return
  modal.classList.add('active')
  overlay.classList.add('active')
}

function closeModal(modal) {
  if (modal == null) return
  modal.classList.remove('active')
  overlay.classList.remove('active')
}

function SetModalTitle(title) {
    const modalTitle = document.getElementById('popup-title');
    modalTitle.innerText = title;
}

function SetModalBody(body) {
    const modalBody = document.getElementById('popup-body');
    modalBody.innerHTML = body;
}   