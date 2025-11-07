// Listen for export button click and send message to content script
document.addEventListener('DOMContentLoaded', function() {
	const btn = document.getElementById('export-btn');
	const ratingCheckbox = document.getElementById('include-rating');
	const reviewCheckbox = document.getElementById('include-review');
	const formatCheckbox = document.getElementById('format-goodreads');
    const formContainer = document.getElementById('form-container');
    const notOnPage = document.getElementById('not-on-page');
	if (btn) {
		btn.addEventListener('click', function() {
			// Send message to content script in active tab with checkbox states
			if (chrome && chrome.tabs) {
				chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
					chrome.tabs.sendMessage(tabs[0].id, {
						action: 'export_books_csv',
						includeRating: ratingCheckbox?.checked ?? true,
						includeReview: reviewCheckbox?.checked ?? true,
                        formatGoodreads: formatCheckbox?.checked ?? false
					});
				});
			}
		});
	}

    function isBiblioteczkaUrl(url) {
        try {
            const u = new URL(url);
            return u.protocol === 'https:' && u.hostname === 'lubimyczytac.pl' && u.pathname.replace(/\/+$/,'') === '/biblioteczka';
        } catch (e) {
            return false;
        }
    }

    function updateForActiveTab() {
        if (!(chrome && chrome.tabs)) return;
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const tab = tabs && tabs[0];
            const ok = tab && isBiblioteczkaUrl(tab.url);
            if (ok) {
                if (formContainer) formContainer.style.display = '';
                if (notOnPage) notOnPage.style.display = 'none';
            } else {
                if (formContainer) formContainer.style.display = 'none';
                if (notOnPage) notOnPage.style.display = '';
            }
        });
    }

    // Refresh when active tab changes or when a tab's URL updates while popup is open
    if (chrome && chrome.tabs) {
        updateForActiveTab();
        try {
            chrome.tabs.onActivated.addListener(function() {
                updateForActiveTab();
            });
        } catch (e) { }
        try {
            chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
                if (changeInfo && changeInfo.url) updateForActiveTab();
            });
        } catch (e) { }
    }
});

let translations = {};
async function loadTranslations(lang) {
    try {
        const res = await fetch(`locales/${lang}.json`);
        translations[lang] = await res.json();
        setLang(lang);
    } catch (e) {
        console.error('Error loading translations for', lang, e);
    }
}

function setLang(lang) {
    const t = translations[lang];
    if (!t) return;
    document.getElementById('title').textContent = t.title;
    document.getElementById('label-rating').textContent = t.labelRating;
    document.getElementById('label-review').textContent = t.labelReview;
    document.getElementById('label-goodreads').textContent = t.labelGoodreads;
    document.getElementById('label-goodreads').title = t.labelGoodreadsTitle;
    document.getElementById('export-btn').textContent = t.exportBtn;
    document.documentElement.lang = lang;
    // populate not-on-page texts if present
    const noPageTextEl = document.getElementById('not-on-page-text');
    const biblLinkEl = document.getElementById('biblioteczka-link');
    if (noPageTextEl) noPageTextEl.textContent = t.notOnPageText;
    if (biblLinkEl) biblLinkEl.textContent = t.biblioteczkaUrl;
}

function getBrowserLang() {
    const lang = navigator.language || navigator.userLanguage || 'pl';
    if (lang.startsWith('en')) return 'en';
    return 'pl';
}

const browserLang = getBrowserLang();
loadTranslations(browserLang);