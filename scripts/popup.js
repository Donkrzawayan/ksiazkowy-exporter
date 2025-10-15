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