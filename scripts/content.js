// Fetch book details from book page: ISBN
async function getBookDetails(bookUrl) {
    try {
        const response = await fetch(bookUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // ISBN
        let isbn = doc.querySelector('meta[property="books:isbn"]')?.content ||
                   doc.querySelector('meta[name="isbn"]')?.content || "";
        return isbn;
    } catch (e) {
        return "";
    }
}

function escapeCSV(val) {
    if (val == null) return "";
    val = String(val);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

function parseBookCard(row, includeRating, includeReview) {
    // Title and book URL
    const titleEl = row.querySelector('a.book-card__title, .book-card__title');
    const title = (titleEl?.getAttribute('title') || titleEl?.textContent || '').replace(/\s+/g, ' ').trim();

    let bookUrl = titleEl?.getAttribute('href') || row.querySelector('form.book-card__cover-link')?.getAttribute('action') || "";
    if (bookUrl && !bookUrl.startsWith('http')) {
        try {
            bookUrl = new URL(bookUrl, window.location.origin).href;
        } catch (e) { }
    }

    // Author(s)
    const authorLinks = row.querySelectorAll('.book-card__author a, a[href*="/autor/"]');
    let author = "";
    if (authorLinks.length > 0) {
        const authors = Array.from(authorLinks).map(a => a.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        author = Array.from(new Set(authors)).join(', ');
    } else {
        author = row.querySelector('.book-card__author')?.textContent.replace(/\s+/g, ' ').trim() || "";
    }

    // My rating
    let myRating = "";
    if (includeRating) {
        const myRatingEl = row.querySelector('.book-card__detail--my-rating .rating__avarage, .book-card__detail--my-rating .rating__average');
        if (myRatingEl) {
            myRating = myRatingEl.textContent.trim();
        }
    }

    // Avg rating
    let avgRating = "";
    const avgRatingEl = row.querySelector('.book-card__detail--rating .rating__avarage, .book-card__detail--rating .rating__average');
    if (avgRatingEl) {
        avgRating = avgRatingEl.textContent.trim();
    }

    // Date Read
    let dateRead = "";
    const dateReadDiv = row.querySelector('.book-card__read-dates, [class*="read-date"]');
    if (dateReadDiv) {
        const match = dateReadDiv.innerText.match(/\d{4}(?:-\d{2}(?:-\d{2})?)?/);
        dateRead = match ? match[0] : "";
    }

    // Shelves
    const shelfNodes = row.querySelectorAll('.book-card__shelf');
    let shelves = "";
    if (shelfNodes.length > 0) {
        const list = Array.from(shelfNodes).map(s => s.getAttribute('title')?.trim() || s.textContent.trim()).filter(Boolean);
        shelves = Array.from(new Set(list)).join(', ');
    }

    // My Review
    let myReview = "";
    if (includeReview) {
        const reviewEl = row.querySelector('.book-card__review p.expandTextNoJS, .expandTextNoJS');
        if (reviewEl) {
            myReview = reviewEl.textContent.trim();
        }
    }

    return {
        title,
        author,
        bookUrl,
        myRating,
        avgRating,
        dateRead,
        shelves,
        myReview
    };
}


function findObjectId() {
    const fromUrl = new URLSearchParams(window.location.search).get('objectId');
    if (fromUrl) return fromUrl;
    const vp = document.querySelector('[data-viewparams*="accountId="]');
    const m1 = vp?.getAttribute('data-viewparams').match(/accountId=(\d+)/);
    if (m1) return m1[1];
    const m2 = document.querySelector('a[href*="/profil/"]')?.getAttribute('href')?.match(/\/profil\/(\d+)/);
    return m2 ? m2[1] : null;
}

function buildRequestBody(page) {
    const src = new URLSearchParams(window.location.search);
    const out = new URLSearchParams();
    for (const [k, v] of src) {
        if (k === 'page' || k === '_req') continue;
        out.append(k, v);
    }
    if (!out.has('objectId')) {
        const oid = findObjectId();
        if (oid) out.set('objectId', oid);
    }
    if (!out.has('own')) out.set('own', '1');
    if (!out.has('listId')) out.set('listId', 'booksFilteredList');
    if (!out.has('listType')) out.set('listType', 'list');
    if (!out.has('paginatorType')) out.set('paginatorType', 'Standard');
    if (!out.has('findString')) out.set('findString', '');
    if (!out.has('kolejnosc')) out.set('kolejnosc', 'data-dodania');
    out.set('page', String(page));
    return out.toString();
}

// Downloading a given page from the library via the internal service endpoint
async function fetchLibraryPage(page) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    const response = await fetch('/profile/getLibraryBooksList', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {})
        },
        body: buildRequestBody(page)
    });

    const raw = await response.text();
    let html = raw;
    try {
        const json = JSON.parse(raw);
        if (json.data && json.data.content) {
            html = json.data.content;
        } else if (typeof json === 'object') {
            for (const val of Object.values(json)) {
                if (typeof val === 'string' && /<\w[\s\S]*>/.test(val)) {
                    html = val;
                    break;
                }
            }
        }
    } catch (e) {
    }

    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}

function getTotalPages(doc) {
    const pagerInput = doc.querySelector('input.jsPagerInput');
    if (pagerInput) {
        const maxAttr = pagerInput.getAttribute('data-maxpage') || pagerInput.getAttribute('max');
        const parsedMax = parseInt(maxAttr, 10);
        if (!isNaN(parsedMax) && parsedMax > 0) {
            return parsedMax;
        }
    }

    return 1;
}

async function fetchBooksFromLibrary(includeRating, includeReview) {
    const collectedBooks = [];
    const ROW_SELECTOR = '.book-card, [id^="listBookElement"]';
    const DELAY_BETWEEN_PAGES_MS = 300;

    let firstDoc;
    try {
        firstDoc = await fetchLibraryPage(1);
    } catch (error) {
        console.warn('[Exporter] Failed to fetch page 1:', error);
        return collectedBooks;
    }

    const totalPages = getTotalPages(firstDoc);

    for (let page = 1; page <= totalPages; page++) {
        // Reuse the first page DOM instead of re-fetching it
        let doc = (page === 1) ? firstDoc : null;

        if (!doc) {
            try {
                doc = await fetchLibraryPage(page);
            } catch (error) {
                console.warn(`[Exporter] Failed to fetch page ${page} of ${totalPages}:`, error);
                break;
            }
        }

        const rows = doc.querySelectorAll(ROW_SELECTOR);
        if (!rows || rows.length === 0) {
            break;
        }

        const pageBooks = [];
        for (const row of rows) {
            const book = parseBookCard(row, includeRating, includeReview);
            if (book.title) {
                pageBooks.push(book);
            }
        }

        await Promise.all(
            pageBooks.map(async (book) => {
                book.isbn = book.bookUrl ? await getBookDetails(book.bookUrl) : "";
            })
        );

        collectedBooks.push(...pageBooks);

        // Short pause to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
    }

    return collectedBooks;
}

async function getAllBooks(includeRating, includeReview) {
    const books = await fetchBooksFromLibrary(includeRating, includeReview);

    return books.map((book, idx) => [
        book.title,
        book.author,
        book.isbn || "",
        book.myRating,
        book.avgRating,
        "", "", "", "", // publisher, binding, year published, original year
        book.dateRead,
        "", // date added
        book.shelves,
        "", // bookshelves
        book.myReview
    ]);
}

function formatGoodreads(books) {
    books.forEach(book => {
        // Convert myRating from 0-10 to 1-5 scale
        let myRating = parseInt(book[3]);
        if (!isNaN(myRating) && myRating > 0) {
            book[3] = String(Math.ceil(myRating / 2));
        }

        // Date Read fill missing month/day with 01
        let dateRead = book[9];
        if (dateRead && /^\d{4}$/.test(dateRead)) {
            book[9] = dateRead + '/01/01';
        } else if (dateRead && /^\d{4}-\d{2}$/.test(dateRead)) {
            book[9] = dateRead + '/01';
        }

        // Translate default shelves from Polish to English
        const shelfMap = {
            'chcę przeczytać': 'to-read',
            'przeczytane': 'read',
            'czytam teraz': 'currently-reading'
        };
        book[11] = book[11].split(',')
            .map(shelf => shelf.trim())
            .map(shelf => {
                const lowerShelf = shelf.toLowerCase();
                if (shelfMap.hasOwnProperty(lowerShelf)) {
                    return shelfMap[lowerShelf];
                }

                // 'If your import file includes a field for tags or shelf names, separate multiple tag/shelf names with spaces.'
                // goodreads does not allow spaces in shelf names
                return shelf.replace(/ /g, '-');
            })
            .join(', ');
    });

    return books;
}

async function exportBooksToCSV(request) {
    const headers = [
        "Title", "Author", "ISBN", "My Rating", "Average Rating", "Publisher", "Binding", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Shelves", "Bookshelves", "My Review"
    ];
    const includeRating = request?.includeRating ?? true;
    const includeReview = request?.includeReview ?? true;
    const shouldFormatForGoodreads = request?.formatGoodreads ?? false;
    let books = await getAllBooks(includeRating, includeReview);
    if (shouldFormatForGoodreads) {
        books = formatGoodreads(books);
    }
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

if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'export_books_csv') {
            exportBooksToCSV(request);
        }
    });
}
