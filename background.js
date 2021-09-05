chrome.tabs.onUpdated.addListener(() => {
    chrome.webRequest.onCompleted.addListener(
        CheckWebRequests,
        { urls: ["*://www.sianet.edu.pe/*"] } //https://developer.chrome.com/docs/extensions/mv3/match_patterns/
    );
}); 

function CheckWebRequests(details) {
    let url = details.url;
    if (url.includes('Academico/CalendarioAcademico/List')) {
        chrome.storage.sync.set({"link": url});
        console.log('Link updated: ', url);
        return;
    }
    if (url.includes('PerfilComun/ConsultaHorarioClases/HorarioClases')) {
        chrome.storage.sync.set({"schedule": url});
        console.log('Schedule updated: ', url);
        return;
    }
}
