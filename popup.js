document.getElementById('search').addEventListener('keyup', function(event) { // On key pressed while search bar is focused
    let query = event.target.value;
    console.log(query);
    document.getElementById('tableData').childNodes.forEach((tr) => { // Each assignment
        tr.childNodes.forEach((td) => { // Each column
            if (td.className == 'title') {
                let regex = new RegExp(query, 'i');
                let normalizedColumnTitle = td.innerText.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Ignore accents/diacritics
                if (!regex.test(normalizedColumnTitle)) {
                    tr.style.display = 'none'
                } else {
                    tr.style.display = ''
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

Main(); // Entry Point

async function Main() {
    if (await IsFetchTimeoutElapsed() === true) {
        UpdateAll();
    }
    initStorageCache;
    if (IsTableEmpty() === true) {
        chrome.storage.sync.set({'last-time-fetch': 0}); // Reset fetch timeout
    }
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
                if (data[index].stDescripcionInterna.length > 6000) {
                    // Remove all html tags if text is too long
                    var rawHtml = data[index].stDescripcionInterna;
                    var div = document.createElement("div");
                    div.innerHTML = rawHtml;
                    data[index].stDescripcionInterna = div.textContent || div.innerText || "Description is too long.";
                    div.remove();
                    console.log(`${index}th description was too long`);
                }
                chrome.storage.sync.set({[index.toString()]: data[index] }, function() {
                    console.log(`${index} Calendar updated: `, data[index]);
                });
            }

            chrome.storage.sync.set({'length' : data.length});
    });
}

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
            console.warn('Error at item ', index);
            console.warn(error);
        }
    }
}).then(() => {
    repeated.length = repeated.length / 2;
    try {
        repeated.forEach((id) => {
            var endElem = document.getElementsByClassName(id)[0]; // Second element to be added, contains true END date
            var startElem = document.getElementsByClassName(id)[1]; // First element to be added, contains true START date 
            endElem.childNodes[3].innerText = startElem.childNodes[3].innerText; // Chanege starting date
            startElem.remove();
        });
    } catch (error) {
        console.warn('Error deleting repeated elements');
        console.warn(error);
    }

    try {
        PopupEventListeners();
    } catch (error) {
        console.warn('Error adding event listeners to buttons');
        console.warn(error);
    }
    
    var table = document.getElementById('assignmentsTable');
    sortTable(table, 6, -1);
});

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
            k+= `<td class="end" ${CheckEndDate(obj)}>` + ParseDate(obj.end); + '</td>'
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
    let date = Date.parse(str);
    return new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(date);
}

function ParseDateToInt(str) {
    return Date.parse(str);
}

function CheckEndDate(obj) {
    /*if (Date.parse(obj.end) > new Date().getTime() && obj.tipo === '_TAREA' || obj.tipo === '_AGENDA') {
        return 'style="color: red;"';
    }*/
    return;
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

// SORT TABLE
/**
 * Sort the rows in a HTML Table
 *
 * @param Table The Table DOM object
 * @param col   The zero-based column number by which to sort
 * @param dir   Optional. The sort direction; pass 1 for asc; -1 for desc
 * @returns void
 */
function sortTable(Table, col, dir) {
    var sortClass, i;

    // get previous sort column
    sortTable.sortCol = -1;
    sortClass = Table.className.match(/js-sort-\d+/);
    if (null != sortClass) {
        sortTable.sortCol = sortClass[0].replace(/js-sort-/, '');
        Table.className = Table.className.replace(new RegExp(' ?' + sortClass[0] + '\\b'), '');
    }
    // If sort column was not passed, use previous
    if ('undefined' === typeof col) {
        col = sortTable.sortCol;
    }

    if ('undefined' !== typeof dir) {
        // Accept -1 or 'desc' for descending.  All else is ascending
        sortTable.sortDir = dir == -1 || dir == 'desc' ? -1 : 1;
    } else {
        // sort direction was not passed, use opposite of previous
        sortClass = Table.className.match(/js-sort-(a|de)sc/);
        if (null != sortClass && sortTable.sortCol == col) {
            sortTable.sortDir = 'js-sort-asc' == sortClass[0] ? -1 : 1;
        } else {
            sortTable.sortDir = 1;
        }
    }
    Table.className = Table.className.replace(/ ?js-sort-(a|de)sc/g, '');

    // update sort column
    Table.className += ' js-sort-' + col;
    sortTable.sortCol = col;

    // update sort direction
    Table.className += ' js-sort-' + (sortTable.sortDir == -1 ? 'desc' : 'asc');

    // get sort type
    if (col < Table.tHead.rows[Table.tHead.rows.length - 1].cells.length) {
        sortClass = Table.tHead.rows[Table.tHead.rows.length - 1].cells[col].className.match(/js-sort-[-\w]+/);
    }
    // Improved support for colspan'd headers
    for (i = 0; i < Table.tHead.rows[Table.tHead.rows.length - 1].cells.length; i++) {
        if (col == Table.tHead.rows[Table.tHead.rows.length - 1].cells[i].getAttribute('data-js-sort-colNum')) {
            sortClass = Table.tHead.rows[Table.tHead.rows.length - 1].cells[i].className.match(/js-sort-[-\w]+/);
        }
    }
    if (null != sortClass) {
        sortTable.sortFunc = sortClass[0].replace(/js-sort-/, '');
    } else {
        sortTable.sortFunc = 'string';
    }
    // Set the headers for the active column to have the decorative class
    Table.querySelectorAll('.js-sort-active').forEach(function(Node) {
        Node.className = Node.className.replace(/ ?js-sort-active\b/, '');
    });
    Table.querySelectorAll('[data-js-sort-colNum="' + col + '"]:not(:empty)').forEach(function(Node) {
        Node.className += ' js-sort-active';
    });

    // sort!
    var rows = [],
        TBody = Table.tBodies[0];

    for (i = 0; i < TBody.rows.length; i++) {
        rows[i] = TBody.rows[i];
    }
    if ('none' != sortTable.sortFunc) {
        rows.sort(sortTable.compareRow);
    }

    while (TBody.firstChild) {
        TBody.removeChild(TBody.firstChild);
    }
    for (i = 0; i < rows.length; i++) {
        TBody.appendChild(rows[i]);
    }
}

/**
 * Compare two table rows based on current settings
 *
 * @param RowA A TR DOM object
 * @param RowB A TR DOM object
 * @returns {number} 1 if RowA is greater, -1 if RowB, 0 if equal
 */
sortTable.compareRow = function(RowA, RowB) {
    var valA, valB;
    if ('function' != typeof sortTable[sortTable.sortFunc]) {
        sortTable.sortFunc = 'string';
    }
    valA = sortTable[sortTable.sortFunc](RowA.cells[sortTable.sortCol]);
    valB = sortTable[sortTable.sortFunc](RowB.cells[sortTable.sortCol]);

    return valA == valB ? 0 : sortTable.sortDir * (valA > valB ? 1 : -1);
};

/**
 * Strip all HTML, no exceptions
 * @param html
 * @returns {string}
 */
sortTable.stripTags = function(html) {
    return html.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 * Converts innerHTML to a timestamp, 0 for invalid dates
 *
 * @param Cell A TD DOM object
 * @returns {Number}
 */
sortTable.date = function(Cell) {
    // If okDate library is available, Use it for advanced Date processing
    if (typeof okDate !== 'undefined') {
        var kDate = okDate(sortTable.stripTags(Cell.innerHTML));
        return kDate ? kDate.getTime() : 0;
    } else {
        return (new Date(sortTable.stripTags(Cell.innerHTML))).getTime() || 0;
    }
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 * Converts innerHTML to a JS Number object
 *
 * @param Cell A TD DOM object
 * @returns {Number}
 */
sortTable.number = function(Cell) {
    return Number(sortTable.stripTags(Cell.innerHTML).replace(/[^-\d.]/g, ''));
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 * Converts innerHTML to a lower case string for insensitive compare
 *
 * @param Cell A TD DOM object
 * @returns {String}
 */
sortTable.string = function(Cell) {
    return sortTable.stripTags(Cell.innerHTML).toLowerCase();
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 *
 * @param Cell A TD DOM object
 * @returns {String}
 */
sortTable.raw = function(Cell) {
    return Cell.innerHTML;
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 * Captures the last space-delimited token from innerHTML
 *
 * @param Cell A TD DOM object
 * @returns {String}
 */
sortTable.last = function(Cell) {
    return sortTable.stripTags(Cell.innerHTML).split(' ').pop().toLowerCase();
};

/**
 * Helper function that converts a table cell (TD) to a comparable value
 * Captures the value of the first childNode
 *
 * @param Cell A TD DOM object
 * @returns {String}
 */
sortTable.input = function(Cell) {
    for (var i = 0; i < Cell.children.length; i++) {
        if ('object' == typeof Cell.children[i]
            && 'undefined' != typeof Cell.children[i].value
        ) {
            return Cell.children[i].value.toLowerCase();
        }
    }

    return sortTable.string(Cell);
};

/**
 * Helper function that prevents sorting by always returning null
 *
 * @param Cell A TD DOM object
 * @returns null
 */
sortTable.none = function(Cell) {
    return null;
};

/**
 * Return the click handler appropriate to the specified Table and column
 *
 * @param Table Table to sort
 * @param col   Column to sort by
 * @returns {Function} Click Handler
 */
sortTable.getClickHandler = function(Table, col) {
    return function() {
        sortTable(Table, col);
    };
};

/**
 * Attach sortTable() calls to table header cells' onclick events
 * If the table(s) do not have a THead node, one will be created around the
 *  first row
 */
sortTable.init = function() {
    var THead, Tables, Handler;
    if (document.querySelectorAll) {
        Tables = document.querySelectorAll('table.js-sort-table');
    } else {
        Tables = document.getElementsByTagName('table');
    }

    for (var i = 0; i < Tables.length; i++) {
        // Because IE<8 doesn't support querySelectorAll, skip unclassed tables
        if (!document.querySelectorAll && null === Tables[i].className.match(/\bjs-sort-table\b/)) {
            continue;
        }

        // Prevent repeat processing
        if (Tables[i].attributes['data-js-sort-table']) {
            continue;
        }

        // Ensure table has a tHead element
        if (!Tables[i].tHead) {
            THead = document.createElement('thead');
            THead.appendChild(Tables[i].rows[0]);
            Tables[i].insertBefore(THead, Tables[i].children[0]);
        } else {
            THead = Tables[i].tHead;
        }

        // Attach click events to table header
        for (var rowNum = 0; rowNum < THead.rows.length; rowNum++) {
            for (var cellNum = 0, colNum = 0; cellNum < THead.rows[rowNum].cells.length; cellNum++) {
                // Skip headers marked "js-sort-none"
                if (THead.rows[rowNum].cells[cellNum].className.match(/\bjs-sort-none\b/)) {
                    continue;
                }
                // Define which column the header should invoke sorting for
                THead.rows[rowNum].cells[cellNum].setAttribute('data-js-sort-colNum', colNum);
                Handler = sortTable.getClickHandler(Tables[i], colNum);
                window.addEventListener
                    ? THead.rows[rowNum].cells[cellNum].addEventListener('click', Handler)
                    : window.attachEvent && THead.rows[rowNum].cells[cellNum].attachEvent('onclick', Handler);
                colNum += THead.rows[rowNum].cells[cellNum].colSpan;
            }
        }

        // Mark table as processed
        Tables[i].setAttribute('data-js-sort-table', 'true')
    }

    // Add default styles as the first style in head so they can be easily overwritten by user styles
    var element = document.createElement('style');
    document.head.insertBefore(element, document.head.childNodes[0]);
    var sheet = element.sheet;
    sheet.insertRule('table.js-sort-table.js-sort-asc thead tr > .js-sort-active:not(.js-sort-none):after {content: "\\25b2";font-size: 0.7em;padding-left: 3px;line-height: 0.7em;}', 0);
    sheet.insertRule('table.js-sort-table.js-sort-desc thead tr > .js-sort-active:not(.js-sort-none):after {content: "\\25bc";font-size: 0.7em;padding-left: 3px;line-height: 0.7em;}', 0);
};

// Run sortTable.init() when the page loads
window.addEventListener ? window.addEventListener('load', sortTable.init, false) : window.attachEvent && window.attachEvent('onload', sortTable.init);

// Shim for IE11's lack of NodeList.prototype.forEach
if (typeof NodeList.prototype.forEach !== "function") {
    NodeList.prototype.forEach = Array.prototype.forEach;
}
