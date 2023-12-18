$("#search").attr("placeholder", chrome.i18n.getMessage("search") + '...').val("").focus().blur()
$("#message-if-empty").text(chrome.i18n.getMessage("no_assignments_message"))
$("#schedule").text(chrome.i18n.getMessage("open_schedule"))
$("#table-title").text(chrome.i18n.getMessage("assignment_title"));
$("#table-subject").text(chrome.i18n.getMessage("assignment_subject"));
$("#table-type").text(chrome.i18n.getMessage("assignment_type"));
$("#table-starting-date").text(chrome.i18n.getMessage("assignment_starting_date"));
$("#table-deathline").text(chrome.i18n.getMessage("assignment_deathline"));
$("#table-more-info").text(chrome.i18n.getMessage("assignment_more_info"));
$("#load-more").text(chrome.i18n.getMessage("load_more"));
$("#credits").text(chrome.i18n.getMessage("credits") + ' Vulcan#2944')