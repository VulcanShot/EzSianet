document.getElementById('save-button').addEventListener('click', SetLink);

function SetLink() {
    var url = document.getElementById('link').value;
    console.log('URL updated manually: ', url)
    chrome.storage.sync.set({link: url});
}