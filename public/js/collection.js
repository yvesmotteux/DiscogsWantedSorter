const socket = io();

const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressStatus = document.getElementById('progress-status');
const resultsContainer = document.getElementById('results-container');
const resultsHeading = document.getElementById('results-heading');
const recordsTbody = document.getElementById('records-tbody');
const noResults = document.getElementById('no-results');

let currentRecords = [];
let currentSortColumn = 'wantCount';
let currentSortDirection = 'desc';

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

socket.on('progress', function(data) {
    if (data.type === 'complete' || data.type === 'error' || 
        (data.total > 0 && (data.current === 1 || data.current === data.total || data.current % 10 === 0))) {
        console.log('Progress update:', data);
    }
    
    progressContainer.style.display = 'block';
    
    progressText.textContent = data.message;
    
    if (data.total > 0) {
        const percentage = Math.min(100, Math.round((data.current / data.total) * 100));
        progressBar.style.width = percentage + '%';
        progressStatus.textContent = `${data.current} of ${data.total} (${percentage}%)`;
    } else {
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Preparing...';
    }
    
    if (data.type === 'enhancement' && data.current === 0) {
        resultsContainer.style.display = 'block';
        noResults.style.display = 'none';
        resultsHeading.textContent = 'Processing Records...';
    }
    
    if (data.type === 'complete') {
        progressText.textContent = 'Processing complete!';
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    }
    
    if (data.type === 'error') {
        progressText.textContent = 'Error';
        progressStatus.textContent = data.message;
        progressBar.style.backgroundColor = '#ff6b6b';
    }
});

/**
 * Calculate the scarcity ratio for a record
 * Improved formula that considers:
 * - Want Count: How many people want this record
 * - Have Count: How many people already have this record
 * - For Sale Count: How many copies are currently available
 * 
 * The formula gives higher scores to records that:
 * 1. Are wanted by many people
 * 2. Are owned by relatively few people
 * 3. Have few or no copies for sale
 */
function calculateScarcityRatio(record) {
    const wantCount = parseInt(record.wantCount) || 0;
    const haveCount = parseInt(record.haveCount) || 1; // Avoid division by zero
    const numForSale = parseInt(record.numForSale) || 0;
    
    const wantToHaveRatio = wantCount / (haveCount + 100); // Adding 100 to prevent extreme values for very rare items
    const availabilityFactor = 1 / (numForSale + 1); // Higher when fewer copies are for sale
    const scarcityScore = wantToHaveRatio * availabilityFactor * 1000;
    
    return parseFloat(scarcityScore.toFixed(1));
}

socket.on('recordEnhanced', function(data) {
    if (currentRecords.length < 5 || currentRecords.length % 20 === 0) {
        console.log('Record enhanced:', data.record.title);
    }
    
    resultsContainer.style.display = 'block';
    noResults.style.display = 'none';
    
    resultsHeading.textContent = 'Records (updating in real-time)';
    
    data.record.scarcityRatio = calculateScarcityRatio(data.record);
    
    currentRecords.push(data.record);
    
    sortRecords();
    
    renderRecords();
});

function sortRecords() {
    currentRecords.sort((a, b) => {
        let aValue = a[currentSortColumn];
        let bValue = b[currentSortColumn];
        
        if (['haveCount', 'wantCount', 'year', 'medianPrice', 'scarcityRatio', 'numForSale', 'lastSoldPrice'].includes(currentSortColumn)) {
            aValue = parseFloat(String(aValue).replace(/[^0-9.-]+/g, '')) || 0;
            bValue = parseFloat(String(bValue).replace(/[^0-9.-]+/g, '')) || 0;
        } 
        else if (currentSortColumn === 'lastSoldDate') {
            if (aValue === 'N/A') return currentSortDirection === 'asc' ? 1 : -1;
            if (bValue === 'N/A') return currentSortDirection === 'asc' ? -1 : 1;
            
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }
        
        if (currentSortDirection === 'asc') {
            if (aValue < bValue) return -1;
            if (aValue > bValue) return 1;
            return 0;
        } else {
            if (aValue < bValue) return 1;
            if (aValue > bValue) return -1;
            return 0;
        }
    });
}

function renderRecords() {
    recordsTbody.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    
    currentRecords.forEach(record => {
        if (typeof record.scarcityRatio === 'undefined') {
            record.scarcityRatio = calculateScarcityRatio(record);
        }
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="numeric-cell">${currentRecords.indexOf(record) + 1}</td>
            <td class="cover-cell">
                <a href="${record.releaseUrl}" target="_blank">
                    <img src="${record.thumbnailUrl || 'https://via.placeholder.com/50?text=No+Image'}" 
                         alt="${escapeHTML(record.title)}" 
                         title="${escapeHTML(record.artist)} - ${escapeHTML(record.title)}">
                </a>
            </td>
            <td class="artist-col">${escapeHTML(record.artist)}</td>
            <td class="title-col"><a href="${record.releaseUrl}" target="_blank">${escapeHTML(record.title)}</a></td>
            <td class="format-col">${escapeHTML(record.format)}</td>
            <td class="have-col numeric-cell">
                ${record.haveCount}
            </td>
            <td class="want-col numeric-cell">
                ${record.wantCount}
            </td>
            <td class="numeric-cell">${record.numForSale || 0}</td>
            <td class="numeric-cell">${record.scarcityRatio}</td>
            <td class="price-col numeric-cell">${record.currency || '€'}${record.medianPrice || '0.00'}</td>
        `;
        
        fragment.appendChild(row);
    });
    
    recordsTbody.appendChild(fragment);
    
    updateSortingIndicators();
}

function updateSortingIndicators() {
    const headers = document.querySelectorAll('th.sortable');
    
    headers.forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        
        if (header.dataset.sort === currentSortColumn) {
            header.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });

    updateSortMessage();
}

function updateSortMessage() {
    const subheading = document.getElementById('results-subheading');
    const columnName = getColumnDisplayName(currentSortColumn);
    const direction = currentSortDirection === 'asc' ? 'ascending' : 'descending';
    subheading.textContent = `Sorted by "${columnName}" (${direction})`;
}

function getColumnDisplayName(columnKey) {
    const displayNames = {
        'artist': 'Artist',
        'title': 'Title',
        'format': 'Format',
        'haveCount': 'Have Count',
        'wantCount': 'Want Count',
        'medianPrice': 'Median Price',
        'lastSoldDate': 'Last Sold Date',
        'lastSoldPrice': 'Last Sold Price',
        'numForSale': 'Number For Sale',
        'scarcityRatio': 'Scarcity Ratio'
    };
    return displayNames[columnKey] || columnKey;
}

socket.on('results', function(data) {
    console.log('Results received:', data.success ? 'Success' : 'Failed', 
                data.results ? `(${data.results.length} records)` : '');
    
    progressContainer.style.display = 'none';
    
    if (data.success && data.results && data.results.length > 0) {
        resultsContainer.style.display = 'block';
        noResults.style.display = 'none';
        
        resultsHeading.textContent = `Results for ${data.username}'s Collection`;
        
        data.results.forEach(record => {
            record.scarcityRatio = calculateScarcityRatio(record);
        });
        
        currentRecords = data.results;
        
        renderRecords();
    } else if (data.success) {
        resultsContainer.style.display = 'none';
        noResults.style.display = 'block';
    } else {
        resultsContainer.style.display = 'none';
        noResults.style.display = 'block';
        noResults.innerHTML = `<p class="error">${data.error}</p>`;
    }
});

function setFormHandlers() {
    const searchForm = document.querySelector('.search-form form');
    if (searchForm) {
        searchForm.addEventListener('submit', function() {
            progressContainer.style.display = 'block';
            resultsContainer.style.display = 'none';
            noResults.style.display = 'none';
            
            currentRecords = [];
        });
    }
}

function initSorting() {
    const table = document.getElementById('recordsTable');
    if (!table) return;
    
    const headers = table.querySelectorAll('th.sortable');
    
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.dataset.sort;
            
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }
            
            sortRecords();
            
            renderRecords();
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.body.dataset.loading === 'true') {
        progressContainer.style.display = 'block';
    }
    
    setFormHandlers();
    
    initSorting();
    
    currentSortColumn = 'scarcityRatio';
    currentSortDirection = 'desc';
    
    const subheading = document.getElementById('results-subheading');
    if (subheading) {
        subheading.textContent = 'Sorted by "Scarcity Ratio" (highest ratio first)';
    }
    
    updateSortingIndicators();
});