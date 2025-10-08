// Content script for lubimyczytac.pl/biblioteczka
// Listens for message from popup to export books to CSV

function escapeCSV(val) {
    if (val == null) return "";
    val = String(val);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

function getBooks() {
    // Adjust selectors based on actual page structure
    const rows = document.querySelectorAll('#booksFilteredList');
    const books = [];
    rows.forEach(row => {
        const title = row.querySelector('.authorAllBooks__singleTextTitle')?.innerText.trim() || "";
        const author = row.querySelector('.authorAllBooks__singleTextAuthor')?.innerText.trim() || "";
        const isbn = row.querySelector('[data-isbn]')?.innerText.trim() || "";
        const myRating = row.querySelector('.my-rating, [data-my-rating]')?.innerText.trim() || "";
        const avgRating = row.querySelector('.avg-rating, .listLibrary__ratingStarsNumber')?.innerText.trim() || "";
        const publisher = row.querySelector('.publisher, [data-publisher]')?.innerText.trim() || "";
        const binding = row.querySelector('.binding, [data-binding]')?.innerText.trim() || "";
        const yearPublished = row.querySelector('.year-published, [data-year-published]')?.innerText.trim() || "";
        const origPubYear = row.querySelector('.orig-pub-year, [data-original-publication-year]')?.innerText.trim() || "";
        const dateRead = row.querySelector('.authorAllBooks__read-dates')?.innerText.trim() || "";
        const dateAdded = row.querySelector('.date-added, [data-date-added]')?.innerText.trim() || "";
        const shelves = row.querySelector('.authorAllBooks__singleTextShelfRight')?.innerText.trim() || "";
        const bookshelves = row.querySelector('.bookshelves, [data-bookshelves]')?.innerText.trim() || "";
        const myReview = row.querySelector('.my-review, [data-my-review]')?.innerText.trim() || "";
        books.push([
            title, author, isbn, myRating, avgRating, publisher, binding, yearPublished, origPubYear, dateRead, dateAdded, shelves, bookshelves, myReview
        ]);
    });
    return books;
}

function exportBooksToCSV() {
    const headers = [
        "Title", "Author", "ISBN", "My Rating", "Average Rating", "Publisher", "Binding", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Shelves", "Bookshelves", "My Review"
    ];
    const books = getBooks();
    let csv = headers.join(',') + '\r\n';
    books.forEach(book => {
        csv += book.map(escapeCSV).join(',') + '\r\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lubimyczytac_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Listen for message from popup
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'export_books_csv') {
            exportBooksToCSV();
        }
    });
}
