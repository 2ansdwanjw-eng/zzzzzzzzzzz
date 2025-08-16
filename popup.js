class RobloxCommunityTracker {
    constructor() {
        this.currentCommunityId = null;
        this.isSearching = false;
        this.initializeUI();
    }

    initializeUI() {
        this.communityInput = document.getElementById('communityLink');
        this.searchBtn = document.getElementById('searchBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.statusDiv = document.getElementById('status');
        this.resultsDiv = document.getElementById('results');

        // Event listeners
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.refreshBtn.addEventListener('click', () => this.handleRefresh());
        this.communityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Load saved community link
        this.loadSavedData();
    }

    extractCommunityId(url) {
        try {
            // Handle 2025 format: https://www.roblox.com/communities/35461612/Z9-Market#!/about
            const regex = /https:\/\/www\.roblox\.com\/communities\/(\d+)/;
            const match = url.match(regex);
            
            if (match && match[1]) {
                const communityId = match[1];
                // Validate that it's a reasonable community ID (positive integer)
                if (/^\d+$/.test(communityId) && parseInt(communityId) > 0) {
                    return communityId;
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting community ID:', error);
            return null;
        }
    }

    validateCommunityLink(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'Please enter a community link' };
        }

        url = url.trim();
        if (!url.startsWith('https://www.roblox.com/communities/')) {
            return { valid: false, error: 'Invalid Roblox community link format' };
        }

        const communityId = this.extractCommunityId(url);
        if (!communityId) {
            return { valid: false, error: 'Could not extract valid community ID from link' };
        }

        return { valid: true, communityId };
    }

    async handleSearch() {
        if (this.isSearching) return;

        const link = this.communityInput.value;
        const validation = this.validateCommunityLink(link);

        if (!validation.valid) {
            this.showStatus(validation.error, 'error');
            return;
        }

        this.currentCommunityId = validation.communityId;
        this.isSearching = true;
        this.updateButtonStates();

        try {
            this.showStatus('🔍 Extracting community members...', 'loading');
            
            // Save the community link for future use
            await chrome.storage.local.set({ 
                communityLink: link,
                communityId: this.currentCommunityId
            });

            // Send message to background script to start fetching
            const response = await chrome.runtime.sendMessage({
                action: 'fetchCommunityMembers',
                communityId: this.currentCommunityId
            });

            if (response.success) {
                this.showStatus('✅ Community members found! Analyzing wealth...', 'loading');
                this.startProgressTracking();
            } else {
                throw new Error(response.error || 'Failed to fetch community members');
            }

        } catch (error) {
            console.error('Search error:', error);
            this.showStatus(`❌ Error: ${error.message}`, 'error');
            this.isSearching = false;
            this.updateButtonStates();
        }
    }

    async handleRefresh() {
        if (!this.currentCommunityId || this.isSearching) return;

        this.isSearching = true;
        this.updateButtonStates();

        try {
            this.showStatus('🔄 Refreshing wealth data...', 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'fetchCommunityMembers',
                communityId: this.currentCommunityId
            });

            if (response.success) {
                this.showStatus('✅ Refreshing data...', 'loading');
                this.startProgressTracking();
            } else {
                throw new Error(response.error || 'Failed to refresh data');
            }

        } catch (error) {
            console.error('Refresh error:', error);
            this.showStatus(`❌ Error: ${error.message}`, 'error');
            this.isSearching = false;
            this.updateButtonStates();
        }
    }

    startProgressTracking() {
        const progressInterval = setInterval(async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getProgress'
                });

                if (response.completed) {
                    clearInterval(progressInterval);
                    this.displayResults(response.results);
                    this.isSearching = false;
                    this.updateButtonStates();
                } else {
                    const processed = response.processed || 0;
                    const total = response.total || 0;
                    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                    this.showStatus(`🔄 Processing members: ${processed}/${total} (${percentage}%)`, 'loading');
                }
            } catch (error) {
                console.error('Progress tracking error:', error);
                clearInterval(progressInterval);
                this.isSearching = false;
                this.updateButtonStates();
            }
        }, 1000);
    }

    displayResults(results) {
        if (!results || results.length === 0) {
            this.showStatus('❌ No members found with valuable limited items', 'error');
            this.resultsDiv.style.display = 'none';
            return;
        }

        this.showStatus(`✅ Found ${results.length} wealthy members`, 'success');
        this.resultsDiv.style.display = 'block';

        const html = results.map((member, index) => `
            <div class="member-item">
                <div class="member-rank">#${index + 1}</div>
                <div class="member-info">
                    <div class="member-username">${this.escapeHtml(member.username)}</div>
                    <div class="member-wealth">RAP: ${this.formatRobux(member.totalValue)} Robux</div>
                </div>
            </div>
        `).join('');

        this.resultsDiv.innerHTML = html;
    }

    formatRobux(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showStatus(message, type = '') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
    }

    updateButtonStates() {
        this.searchBtn.disabled = this.isSearching;
        this.refreshBtn.disabled = this.isSearching || !this.currentCommunityId;
        
        if (this.isSearching) {
            this.searchBtn.textContent = '🔄 Searching...';
        } else {
            this.searchBtn.textContent = '🔍 Search for List';
        }
    }

    async loadSavedData() {
        try {
            const data = await chrome.storage.local.get(['communityLink', 'communityId']);
            if (data.communityLink) {
                this.communityInput.value = data.communityLink;
                this.currentCommunityId = data.communityId;
                this.updateButtonStates();
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
}

// Initialize the extension when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new RobloxCommunityTracker();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProgress') {
        // Progress updates are handled by the progress tracking interval
        sendResponse({ received: true });
    }
});