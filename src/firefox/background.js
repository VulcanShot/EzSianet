chrome.runtime.onInstalled.addListener(details => { OnInstallation(details) });
chrome.webRequest.onCompleted.addListener(
  UpdateUrl,
  { urls: ["https://www.sianet.edu.pe/*Academico/CalendarioAcademico/List"] }
);

function UpdateUrl(details) {
  chrome.storage.sync.set({ "link": details.url });
  console.log('Link updated: ', details.url);
}

function OnInstallation(details) {
  if (details.reason != chrome.runtime.OnInstalledReason.INSTALL)
  {
    return;
  }
  chrome.storage.local.set({ 'isFirstTime': true });
}