// Content script for Roblox Community Wealth Tracker
// This script runs in the context of Roblox pages and handles API authentication

class RobloxAPIHelper {
    constructor() {
        this.csrfToken = null;
        this.authCookie = null;
        this.initializeAuth();
    }

    async initializeAuth() {
        try {
            // Get CSRF token from meta tag or make a request to get it
            this.csrfToken = await this.getCSRFToken();
            this.authCookie = await this.getAuthCookie();
        } catch (error) {
            console.error('Failed to initialize Roblox auth:', error);
        }
    }

    async getCSRFToken() {
        try {
            // Try to get from meta tag first
            const metaToken = document.querySelector('meta[name="csrf-token"]');
            if (metaToken) {
                return metaToken.getAttribute('content');
            }

            // If not available, make a request to get it
            const response = await fetch('https://auth.roblox.com/v1/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.headers.get('x-csrf-token')) {
                return response.headers.get('x-csrf-token');
            }

            throw new Error('Could not obtain CSRF token');
        } catch (error) {
            console.error('Error getting CSRF token:', error);
            return null;
        }
    }

    async getAuthCookie() {
        try {
            // Check if user is logged in by looking for the .ROBLOSECURITY cookie
            const cookies = document.cookie.split(';');
            const authCookie = cookies.find(cookie => cookie.trim().startsWith('.ROBLOSECURITY='));
            return authCookie ? authCookie.split('=')[1] : null;
        } catch (error) {
            console.error('Error getting auth cookie:', error);
            return null;
        }
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken || '',
                ...options.headers
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, mergedOptions);
            
            // Handle CSRF token refresh
            if (response.status === 403 && response.headers.get('x-csrf-token')) {
                this.csrfToken = response.headers.get('x-csrf-token');
                mergedOptions.headers['X-CSRF-TOKEN'] = this.csrfToken;
                return await fetch(url, mergedOptions);
            }

            return response;
        } catch (error) {
            console.error('Authenticated request failed:', error);
            throw error;
        }
    }

    async getCommunityMembers(communityId) {
        try {
            // Use the Groups API to get community members
            // Note: Roblox groups API endpoints might change, this is based on current known endpoints
            const url = `https://groups.roblox.com/v1/groups/${communityId}/users?sortOrder=Desc&limit=100`;
            
            const response = await this.makeAuthenticatedRequest(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Error fetching community members:', error);
            throw error;
        }
    }

    async getUserInventory(userId) {
        try {
            // Get user's inventory for limited items
            // Note: This endpoint might require special permissions or might be rate-limited
            const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Desc&limit=100`;
            
            const response = await this.makeAuthenticatedRequest(url);
            
            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limited, wait and retry
                    await this.delay(1000);
                    return this.getUserInventory(userId);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error(`Error fetching inventory for user ${userId}:`, error);
            return [];
        }
    }

    async getAssetValue(assetId) {
        try {
            // Get asset value from economy endpoint
            const url = `https://economy.roblox.com/v1/assets/${assetId}/resale-data`;
            
            const response = await this.makeAuthenticatedRequest(url);
            
            if (!response.ok) {
                return 0;
            }

            const data = await response.json();
            return data.recentAveragePrice || 0;
        } catch (error) {
            console.error(`Error getting asset value for ${assetId}:`, error);
            return 0;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async batchProcessMembers(members, progressCallback) {
        const results = [];
        const processed = 0;
        const batchSize = 10; // Process in smaller batches to avoid rate limits

        for (let i = 0; i < members.length; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (member) => {
                try {
                    const inventory = await this.getUserInventory(member.user.userId);
                    let totalValue = 0;

                    // Process inventory items in parallel but with rate limiting
                    for (const item of inventory) {
                        if (item.assetType === 'Hat' || item.assetType === 'Gear' || 
                            item.assetType === 'Face' || item.assetType === 'Package') {
                            const value = await this.getAssetValue(item.assetId);
                            if (value > 10000) { // Only count items > 10k Robux
                                totalValue += value;
                            }
                        }
                        
                        // Small delay to prevent overwhelming the API
                        await this.delay(50);
                    }

                    return {
                        userId: member.user.userId,
                        username: member.user.username,
                        totalValue: totalValue
                    };
                } catch (error) {
                    console.error(`Error processing member ${member.user.username}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(result => result && result.totalValue > 0));

            // Update progress
            if (progressCallback) {
                progressCallback(i + batch.length, members.length);
            }

            // Delay between batches to respect rate limits
            await this.delay(500);
        }

        // Sort by total value (wealth) in descending order
        return results.sort((a, b) => b.totalValue - a.totalValue);
    }
}

// Initialize the API helper
const robloxAPI = new RobloxAPIHelper();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchCommunityData') {
        handleCommunityDataFetch(request.communityId)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
    }
    
    if (request.action === 'makeAPIRequest') {
        handleAPIRequest(request.url)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Will respond asynchronously
    }
    
    if (request.action === 'ping') {
        sendResponse({ pong: true });
        return false;
    }
});

async function handleAPIRequest(url) {
    try {
        const response = await robloxAPI.makeAuthenticatedRequest(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error('API request failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleCommunityDataFetch(communityId) {
    try {
        console.log(`Fetching data for community ${communityId}`);
        
        // Get community members
        const members = await robloxAPI.getCommunityMembers(communityId);
        
        if (!members || members.length === 0) {
            throw new Error('No members found in this community');
        }

        console.log(`Found ${members.length} members, analyzing wealth...`);

        // Process members and calculate wealth
        const wealthyMembers = await robloxAPI.batchProcessMembers(members, (processed, total) => {
            // Send progress updates to background script
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                processed: processed,
                total: total
            });
        });

        console.log(`Analysis complete. Found ${wealthyMembers.length} wealthy members.`);

        return {
            success: true,
            members: wealthyMembers,
            totalProcessed: members.length
        };

    } catch (error) {
        console.error('Error in handleCommunityDataFetch:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Notify background script that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });