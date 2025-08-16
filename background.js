// Background script for Roblox Community Wealth Tracker

class CommunityWealthTracker {
    constructor() {
        this.isProcessing = false;
        this.currentProgress = {
            processed: 0,
            total: 0,
            completed: false,
            results: []
        };
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'fetchCommunityMembers':
                    this.handleFetchCommunityMembers(request.communityId)
                        .then(response => sendResponse(response))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // Will respond asynchronously

                case 'getProgress':
                    sendResponse(this.currentProgress);
                    return false;

                case 'updateProgress':
                    this.currentProgress.processed = request.processed;
                    this.currentProgress.total = request.total;
                    sendResponse({ received: true });
                    return false;

                case 'contentScriptReady':
                    console.log('Content script ready');
                    sendResponse({ received: true });
                    return false;

                default:
                    sendResponse({ error: 'Unknown action' });
                    return false;
            }
        });
    }

    async handleFetchCommunityMembers(communityId) {
        if (this.isProcessing) {
            return { success: false, error: 'Already processing a community' };
        }

        try {
            this.isProcessing = true;
            this.currentProgress = {
                processed: 0,
                total: 0,
                completed: false,
                results: []
            };

            console.log(`Starting community analysis for ID: ${communityId}`);

            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // If not on Roblox, open a new Roblox tab
            let targetTab = tab;
            if (!tab.url.includes('roblox.com')) {
                targetTab = await chrome.tabs.create({ 
                    url: 'https://www.roblox.com', 
                    active: false 
                });
                
                // Wait for the tab to load
                await this.waitForTabLoad(targetTab.id);
            }

            // Inject the content script if needed
            await this.ensureContentScriptInjected(targetTab.id);

            // Start fetching community data using optimized batch processing
            const result = await this.fetchCommunityDataFast(targetTab.id, communityId);

            if (result.success) {
                this.currentProgress.results = result.members || [];
                this.currentProgress.completed = true;
                this.currentProgress.total = result.totalProcessed || 0;
                this.currentProgress.processed = result.totalProcessed || 0;
            }

            return result;

        } catch (error) {
            console.error('Error in handleFetchCommunityMembers:', error);
            return { success: false, error: error.message };
        } finally {
            this.isProcessing = false;
        }
    }

    async waitForTabLoad(tabId) {
        return new Promise((resolve) => {
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(resolve, 1000); // Additional delay for page initialization
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async ensureContentScriptInjected(tabId) {
        try {
            // Try to ping the content script
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            if (response) return; // Content script is already there
        } catch (error) {
            // Content script not found, inject it
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            
            // Wait a bit for initialization
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async fetchCommunityDataFast(tabId, communityId) {
        try {
            // Use fast batch processing approach
            const members = await this.getAllCommunityMembers(tabId, communityId);
            
            if (!members || members.length === 0) {
                throw new Error('No members found in this community or community is private');
            }

            console.log(`Found ${members.length} total members. Starting wealth analysis...`);
            this.currentProgress.total = members.length;

            // Process members in optimized batches for speed
            const wealthyMembers = await this.processMembersOptimized(tabId, members);

            return {
                success: true,
                members: wealthyMembers,
                totalProcessed: members.length
            };

        } catch (error) {
            console.error('Error in fetchCommunityDataFast:', error);
            throw error;
        }
    }

    async getAllCommunityMembers(tabId, communityId) {
        const allMembers = [];
        let cursor = null;
        let pageCount = 0;
        const maxPages = 200; // Limit to prevent infinite loops, adjust as needed

        try {
            do {
                const url = `https://groups.roblox.com/v1/groups/${communityId}/users?sortOrder=Desc&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
                
                const response = await this.makeAPIRequest(tabId, url);
                
                if (!response.success) {
                    throw new Error(response.error || 'Failed to fetch members');
                }

                const data = response.data;
                if (data.data && data.data.length > 0) {
                    allMembers.push(...data.data);
                }

                cursor = data.nextPageCursor;
                pageCount++;

                // Update progress
                this.currentProgress.processed = allMembers.length;
                
                console.log(`Fetched page ${pageCount}, total members so far: ${allMembers.length}`);

                // Small delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } while (cursor && pageCount < maxPages);

            console.log(`Finished fetching all members. Total: ${allMembers.length}`);
            return allMembers;

        } catch (error) {
            console.error('Error fetching all community members:', error);
            throw error;
        }
    }

    async processMembersOptimized(tabId, members) {
        const wealthyMembers = [];
        const batchSize = 50; // Larger batches for faster processing
        const concurrentBatches = 5; // Process multiple batches simultaneously

        // Filter out members that are likely to have no valuable items (optimization)
        const potentialWealthyMembers = members; // For now, process all, but could add pre-filtering

        for (let i = 0; i < potentialWealthyMembers.length; i += batchSize * concurrentBatches) {
            const batches = [];
            
            // Create multiple batches to process concurrently
            for (let j = 0; j < concurrentBatches; j++) {
                const startIdx = i + (j * batchSize);
                const endIdx = Math.min(startIdx + batchSize, potentialWealthyMembers.length);
                
                if (startIdx < potentialWealthyMembers.length) {
                    const batch = potentialWealthyMembers.slice(startIdx, endIdx);
                    batches.push(this.processMemberBatch(tabId, batch));
                }
            }

            // Process all batches concurrently
            const batchResults = await Promise.all(batches);
            
            // Combine results
            for (const batchResult of batchResults) {
                wealthyMembers.push(...batchResult.filter(member => member && member.totalValue > 0));
            }

            // Update progress
            this.currentProgress.processed = Math.min(i + (batchSize * concurrentBatches), potentialWealthyMembers.length);
            
            console.log(`Processed ${this.currentProgress.processed}/${potentialWealthyMembers.length} members. Found ${wealthyMembers.length} wealthy members so far.`);

            // Small delay between batch groups
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Sort by wealth (total value) in descending order
        wealthyMembers.sort((a, b) => b.totalValue - a.totalValue);

        console.log(`Analysis complete. Found ${wealthyMembers.length} wealthy members out of ${potentialWealthyMembers.length} processed.`);
        return wealthyMembers;
    }

    async processMemberBatch(tabId, memberBatch) {
        try {
            const results = await Promise.all(memberBatch.map(async (member) => {
                try {
                    return await this.analyzeMemberWealth(tabId, member);
                } catch (error) {
                    console.error(`Error analyzing member ${member.user?.username}:`, error);
                    return null;
                }
            }));

            return results.filter(result => result !== null);
        } catch (error) {
            console.error('Error processing member batch:', error);
            return [];
        }
    }

    async analyzeMemberWealth(tabId, member) {
        try {
            const userId = member.user.userId;
            const username = member.user.username;

            // Get user's collectible inventory
            const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?sortOrder=Desc&limit=100`;
            const inventoryResponse = await this.makeAPIRequest(tabId, inventoryUrl);

            if (!inventoryResponse.success) {
                return null;
            }

            const inventory = inventoryResponse.data.data || [];
            let totalValue = 0;
            const valuableItems = [];

            // Process inventory items to calculate total RAP value
            for (const item of inventory) {
                if (item.recentAveragePrice && item.recentAveragePrice > 10000) {
                    totalValue += item.recentAveragePrice;
                    valuableItems.push({
                        name: item.name,
                        value: item.recentAveragePrice
                    });
                }
            }

            // Only return members with significant wealth
            if (totalValue > 10000) {
                return {
                    userId: userId,
                    username: username,
                    totalValue: totalValue,
                    valuableItems: valuableItems
                };
            }

            return null;
        } catch (error) {
            console.error(`Error analyzing wealth for member:`, error);
            return null;
        }
    }

    async makeAPIRequest(tabId, url) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'makeAPIRequest',
                url: url
            });

            return response;
        } catch (error) {
            console.error('Error making API request:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize the background script
const communityTracker = new CommunityWealthTracker();

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Roblox Community Wealth Tracker installed successfully');
});