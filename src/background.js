chrome.runtime.onInstalled.addListener(details => { OnInstallation(details) });
chrome.webRequest.onCompleted.addListener(
  CheckWebRequests,
  { urls: ["*://www.sianet.edu.pe/*"] } //https://developer.chrome.com/docs/extensions/mv3/match_patterns/
);

function CheckWebRequests(details) {
  const url = new URL(details.url);
  const schoolIndependentPathName = url.pathname.split('/').slice(2).join('/');
  chrome.storage.sync.set({ "urlBase": url.origin + url.pathname.split('/').slice(0, 2).join('/') });

  switch (schoolIndependentPathName) {
    case 'Academico/CalendarioAcademico/List':
      chrome.storage.sync.set({ "link": details.url });
      console.log('Link updated: ', details.url);
      break;
    case 'PerfilComun/ConsultaHorarioClases/HorarioClases':
      chrome.storage.sync.set({ "schedule": details.url });
      console.log('Schedule updated: ', details.url);
      break;
    default:
      break;
  }
}

function OnInstallation(details) {
  if (details.reason != chrome.runtime.OnInstalledReason.INSTALL) return;
  chrome.storage.local.set({ 'isFirstTime': true });
}