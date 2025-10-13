function escapeCSV(val) {
    if (val == null) return "";
    val = String(val);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

function getBooksFromPage() {
    const rows = document.querySelectorAll('.authorAllBooks__single');
    const books = [];
    rows.forEach(row => {
        // Title
        const title = row.querySelector('.authorAllBooks__singleTextTitle')?.innerText.trim() || "";
        // Author(s)
        const authorLinks = row.querySelectorAll('.authorAllBooks__singleTextAuthor a');
        let author = "";
        if (authorLinks.length > 0) {
            author = Array.from(authorLinks).map(a => a.innerText.trim()).join(', ');
        } else {
            author = row.querySelector('.authorAllBooks__singleTextAuthor')?.innerText.trim() || "";
        }
        // Average Rating
        const avgRating = row.querySelector('.listLibrary__ratingStarsNumber')?.innerText.trim() || "";
        // Date Read
        let dateRead = "";
        const dateReadDiv = row.querySelector('.authorAllBooks__read-dates');
        if (dateReadDiv) {
            const match = dateReadDiv.innerText.match(/\d{4}-\d{2}-\d{2}/);
            dateRead = match ? match[0] : "";
        }
        // Date Added (not available, leave empty)
        const dateAdded = "";
        // Shelves
        const shelves = row.querySelector('.authorAllBooks__singleTextShelfRight')?.innerText.trim() || "";
        books.push([
            title, author, "", "", avgRating, "", "", "", "", dateRead, dateAdded, shelves, "", ""
        ]);
    });
    return books;
}

async function getAllBooks() {
    let allBooks = [];
    while (true) {
        allBooks = allBooks.concat(getBooksFromPage());
        // Find next page button
        const nextBtn = document.querySelector('.page-item.next-page:not(.disabled) a.page-link');
        if (nextBtn && nextBtn.getAttribute('data-page')) {
            nextBtn.click();
            // Wait for DOM update
            await new Promise(resolve => setTimeout(resolve, 1200));
        } else {
            break;
        }
    }
    return allBooks;
}

async function exportBooksToCSV() {
    const headers = [
        "Title", "Author", "ISBN", "My Rating", "Average Rating", "Publisher", "Binding", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Shelves", "Bookshelves", "My Review"
    ];
    const books = await getAllBooks();
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
