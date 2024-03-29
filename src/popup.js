let removeOverlay = true;
const storage = {};
const ASSIGNMENTS_PER_LOAD = 50;

$('#search').on('input', function (event) {
  let query = RemoveDiacritics(event.target.value);

  if (/^\s*$/.test(query))
    $('#load-more').show()

  else if (storage.hiddenAssignments.length > 0)
    $('#load-more').hide()

  $('body table tbody td.title').each((index, td) => { // Each assignment
    let queryRegex = new RegExp(query, 'i');
    let normalizedColumnTitle = RemoveDiacritics(td.innerText);
    let tr = $(td).parent();
    queryRegex.test(normalizedColumnTitle) ? tr.show() : tr.hide()
  });

  $('body table tr').css('background-color', 'initial');
  ChangeEvenRowColor();
});

$('#schedule').click(function () {
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

$('#mode').click(function () {
  $(document.body).toggleClass('dark');
  if ($(document.body).hasClass('dark')) {
    chrome.storage.local.set({ theme: 'dark' })
    return;
  }
  chrome.storage.local.set({ theme: 'light' })
});

$('#logo').click(function () {
  if (storage.link === undefined) {
    ShowErrorModal();
    return;
  }
  window.open(GetSianetURL(storage.link.href) + 'Home/Index', '_blank');
});

$('.modal').scroll(function () {
  var scrollTop = $(this).scrollTop();

  $('.modal-header').css({
    opacity: function () {
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

  SortTable();

  storage.hiddenAssignments = storage.hiddenAssignments.filter((assignment) => {
    return shown.indexOf(assignment.id) === -1;
  });

  if (storage.hiddenAssignments.length === 0)
    $('#load-more').hide();
});

$(document).keydown((event) => {
  if (event.key !== "Escape" || !$('.modal').hasClass('active'))
    return;

  event.preventDefault();
  closeModal();
});

(async function () {
  SetTheme();
  ShowFirstTimeMessage();
  await GetDataFromStorage().then(itemsFromChrome => {
    Object.assign(storage, itemsFromChrome)
  });
  storage.assignments = await FetchData().then(items => { return items; })
  DisplayData();
  StopLoading();
  ChangeEvenRowColor();
  SetModalTitle("Lorem Ipsum"); // Fixes table increasing width for some reason ( FIND THE REASON D: )
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
  chrome.storage.local.set({ 'isFirstTime': false });
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

  let unusedProperties = ['objModelo', 'stColor', 'stCurso', 'stFechaLeido', 'stFechaRespuesta', 'stMensaje', 'stTipoAsistencia',
    'stTipoAsistenciaDescripcion', 'stToolTip', 'stFechaFin', 'color_c', 'boVisto', 'AsignadoPor', 'inIdAlumnoCicloLectivo',
    'inIdPersona', 'boVencido', 'boRespondido', 'boExito', 'boEsInicio', 'boCalificado', 'boBloqueado', 'allDay', 'stDescripcionMotivo'];

  if (!storage.link) {
    ShowErrorModal();
    return await Promise.reject('There is no data URL');
  }

  storage.link = new URL(storage.link);
  storage.link.searchParams.set('start', encodeURI(new Date(0).toISOString()));
  storage.link.searchParams.set('end', encodeURI(new Date().toISOString()));

  await fetch(storage.link.href)
    .then(response => response.json())
    .then(json => setData(json))
    .then(() => {
      data = data.filter(assignment => assignment.tipo !== '_FERIADOS');
      data.forEach(assignment => {
        unusedProperties.forEach(attribute => {
          delete assignment[attribute];
        });
        assignment.id = 'EZ-' + assignment.id;
      });
    })
    .catch(() => {
      console.log(storage.backup);
      storage.backup.forEach((assignment) => {
        AddToTable(assignment);
      });
      ShowNetworkErrorModal();
      StopLoading();
      throw 'Network Error';
    })
  return await Promise.resolve(data);
}

function DisplayData() {
  console.groupCollapsed('Assignments Table');
  console.log("Source: " + storage.link.href);
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

  if (!storage.hiddenAssignments)
    storage.hiddenAssignments = [];

  for (let index = storage.assignments.length - 1; index >= 0; index--) {
    const assignment = storage.assignments[index];

    if (index >= storage.assignments.length - ASSIGNMENTS_PER_LOAD) {
      AddToTable(assignment);
      backup.push(assignment);
      continue;
    }

    storage.hiddenAssignments.push(assignment);
    $("#load-more").css('display', 'block');
  }

  storage.hiddenAssignments?.reverse();

  SetUpBackup(backup);
  ModalEventListeners();
  SortTable();
};

function SetUpBackup(arr) {
  if (!storage.backup || !ArraysAreEqual(arr, storage.backup))
    chrome.storage.local.set({ backup: arr });
}

function ArraysAreEqual(array1, array2) {
  const array2Sorted = array2.slice().sort();
  return array1.length === array2.length && array1.slice().sort().every(function (value, index) {
    return value === array2Sorted[index];
  });
}

let SortTable = () => sortTable($('body table').get(0), 5, -1);

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
  function createDataCell(className, content) {
    let dataCell = document.createElement('td');
    dataCell.className = className;
    dataCell.innerText = content;
    row.appendChild(dataCell);
  }

  if (obj.tipo === '_FERIADOS') {
    return;
  }

  let row = document.createElement('tr');
  row.id = obj.id;

  createDataCell("title", obj.title.trim());
  createDataCell("subject", ParseSianetSubject(obj.DescripcionCurso));
  createDataCell("type", ParseSianetType(obj.tipo));

  let start = DateToTD(obj.start, 'start');
  row.appendChild(start);

  let end = DateToTD(obj.end, 'end');
  row.appendChild(end);

  createDataCell("real-end", Date.parse(obj.end));

  let moreInfo = document.createElement('td');
  moreInfo.className = "more-info";
  row.appendChild(moreInfo);

  $(moreInfo).click((event) => {
    let row = event.target.closest('tr');
    const assignmentId = row.id;
    let selectedAssignment = storage.assignments.find(assigned => assigned.id === assignmentId);
    SetModalTitle(selectedAssignment.title);
    SetModalBody(selectedAssignment.stDescripcionInterna);
    $('.modal').removeClass('announcement')
    openModal();
    // TODO: Finish implementing attachment stuff
    GetAttachments(selectedAssignment)
  })

  let moreInfoButton = document.createElement('button');
  moreInfoButton.className = "more-info-button";
  moreInfoButton.innerHTML = '&plus;';
  moreInfo.appendChild(moreInfoButton);

  $('body table tbody').append(row);
}

function GetAttachments(assignment) {
  $.ajax({
    type: "GET",
    url: storage.urlBase + "/Academico/CalendarioAcademico/Get",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    data: {
      GA: assignment.id.slice(3), // Slice to remove prefix 'ez-'
      CL: storage.link.searchParams.get('CL'), // 'Ciclo lectivo'
      TP: assignment.tipo,
      IA: assignment.stIdAlumno,
      NTI: assignment.stNombreTablaInterno,
      AA: assignment.stIdActividadAcademica,
      CA: assignment.stIdCursoAsignacion
    },
    dataType: 'html',
  }).done(function (html) {
    const parser = new DOMParser();
    const assignmentDoc = parser.parseFromString(html, "text/html");
    $('a[href*=DownloadFile]', assignmentDoc).map((index, elem) => {
      let indexOfFirstSubdomain = $(elem).attr('href').indexOf('/', 1);
      let relativeHref = $(elem).attr('href').slice(indexOfFirstSubdomain);
      return storage.urlBase + relativeHref;
    }).get();
  }).fail(function (jqXHR, textStatus, errorThrown) {
    console.error(errorThrown)
  });
}

function StopLoading() {
  HideLoader();
  if (removeOverlay) {
    $('#overlay').removeClass('active');
  }
}

function ChangeEvenRowColor() {
  $('body table tr').filter(function () {
    return $(this).css('display') === 'table-row';
  }).even().css('background-color', 'var(--table-secondary-color)');
}

function HideLoader() { $('#loader').css('display', 'none'); }