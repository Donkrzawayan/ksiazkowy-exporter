function escapeCSV(val) {
    if (val == null) return "";
    val = String(val);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

async function getBooksFromPage(includeRating, includeReview) {
    const rows = document.querySelectorAll('.authorAllBooks__single');
    const books = [];
    for (const row of rows) {
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
        // Ratings
        let avgRating = "";
        let myRating = "";
        const ratingNodes = row.querySelectorAll('.listLibrary__ratingStarsNumber');
        ratingNodes.forEach(node => {
            // Find the closest .listLibrary__ratingText in the parent .listLibrary__rating
            const ratingDiv = node.closest('.listLibrary__rating');
            const label = ratingDiv?.querySelector('.listLibrary__ratingText')?.textContent?.trim() || "";
            if (includeRating && label.includes('Twoja ocena')) {
                myRating = node.innerText.trim();
            } else if (label.includes('Średnia ocen')) {
                avgRating = node.innerText.trim();
            }
        });
        // Date Read
        let dateRead = "";
        const dateReadDiv = row.querySelector('.authorAllBooks__read-dates');
        if (dateReadDiv) {
            const match = dateReadDiv.innerText.match(/\d{4}-\d{2}-\d{2}/);
            dateRead = match ? match[0] : "";
        }
        // Shelves
        const shelves = row.querySelector('.authorAllBooks__singleTextShelfRight')?.innerText.trim() || "";
        // My Rating
        let myRating = "";
        if (includeRating) {
            myRating = row.querySelector('.listLibrary__ratingStarsNumber')?.innerText.trim() || "";
        }
        // Book details page URL
        const bookLink = row.querySelector('.authorAllBooks__singleTextTitle a')?.href;
        // My Review
        let myReview = "";
        if (includeReview) {
            myReview = row.querySelector('.expandTextNoJS')?.innerText.trim() || "";
        }
        books.push([
            title, author, "", myRating, avgRating, "", "", "", "", dateRead, "", shelves, "", myReview
        ]);
    }
    return books;
}

async function getAllBooks(includeRating, includeReview) {
    let allBooks = [];
    while (true) {
        allBooks = allBooks.concat(await getBooksFromPage(includeRating, includeReview));
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

async function exportBooksToCSV(request) {
    const headers = [
        "Title", "Author", "ISBN", "My Rating", "Average Rating", "Publisher", "Binding", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Shelves", "Bookshelves", "My Review"
    ];
    const includeRating = request?.includeRating ?? true;
    const includeReview = request?.includeReview ?? true;
    const books = await getAllBooks(includeRating, includeReview);
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
            exportBooksToCSV(request);
        }
    });
}
