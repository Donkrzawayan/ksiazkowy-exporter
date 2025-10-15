// Listen for export button click and send message to content script
document.addEventListener('DOMContentLoaded', function() {
	const btn = document.getElementById('export-btn');
	const ratingCheckbox = document.getElementById('include-rating');
	const reviewCheckbox = document.getElementById('include-review');
	if (btn) {
		btn.addEventListener('click', function() {
			// Send message to content script in active tab with checkbox states
			if (chrome && chrome.tabs) {
				chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
					chrome.tabs.sendMessage(tabs[0].id, {
						action: 'export_books_csv',
						includeRating: ratingCheckbox?.checked ?? true,
						includeReview: reviewCheckbox?.checked ?? true
					});
				});
			}
		});
	}
});

let translations = {};
async function loadTranslations(lang) {
    try {
        const res = await fetch(`locales/${lang}.json`);
        translations[lang] = await res.json();
        setLang(lang);
    } catch (e) {
        translations[lang] = {
            title: lang,
            labelRating: lang,
            labelReview: lang,
            exportBtn: lang
        };
        setLang(lang);
    }
}

function setLang(lang) {
    const t = translations[lang];
    if (!t) return;
    document.getElementById('title').textContent = t.title;
    document.getElementById('label-rating').textContent = t.labelRating;
    document.getElementById('label-review').textContent = t.labelReview;
    document.getElementById('export-btn').textContent = t.exportBtn;
    document.documentElement.lang = lang;
}

function getBrowserLang() {
    const lang = navigator.language || navigator.userLanguage || 'pl';
    if (lang.startsWith('en')) return 'en';
    return 'pl';
}

const browserLang = getBrowserLang();
loadTranslations(browserLang);