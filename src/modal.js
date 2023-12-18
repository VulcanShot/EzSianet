function ModalEventListeners() {
  $('[data-close-button]').click((event) => {
    closeModal();
  })
}

$('#overlay').click(() => {
  $('.modal.active').each((index, modal) => {
    closeModal();
  })
})

function openModal() {
  $('.modal, #overlay').addClass('active')
}

function closeModal() {
  $('.modal, #overlay').removeClass('active')
}

function SetModalTitle(title) {
  $('.modal-title').text(title);
}

function SetModalBody(body) {
  $('[data-modal-body]').html(body);
}

function ShowAnnouncement(title, body) {
  SetModalTitle(title);
  SetModalBody(body);
  $('.modal').addClass('announcement');
  openModal();
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