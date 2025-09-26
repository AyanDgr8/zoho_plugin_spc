// UCP Plugin Background Script
chrome.runtime.onInstalled.addListener(() => {
    console.log('UCP Plugin installed');
    
    // Set default settings
    chrome.storage.sync.set({
        ucpEnabled: true,
        autoOpen: false,
        ucpUrl: 'https://ira-spc-sj.ucprem.voicemeetme.com/ucp/login'
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Send message to content script to toggle UCP
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_UCP'
        });
        
        if (!response || !response.success) {
            console.log('UCP not injected, opening popup instead');
        }
    } catch (error) {
        console.error('Failed to communicate with content script:', error);
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'UCP_INJECTED':
            console.log('UCP injected on:', request.url);
            // Update badge or icon to show UCP is active
            chrome.action.setBadgeText({
                text: '●',
                tabId: sender.tab.id
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#28a745',
                tabId: sender.tab.id
            });
            break;
            
        case 'UCP_INCOMING_CALL':
            handleIncomingCall(request.payload, sender.tab);
            break;
            
        case 'UCP_CALL_ENDED':
            handleCallEnded(request.payload, sender.tab);
            break;
    }
    
    sendResponse({ received: true });
});

// Handle incoming call notifications
function handleIncomingCall(payload, tab) {
    // Show browser notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Incoming Call',
        message: `Call from queue: ${payload.queue_name || 'Unknown'}`,
        priority: 2
    });
    
    // Focus the tab with UCP
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
}

// Handle call ended
function handleCallEnded(payload, tab) {
    // Clear any notifications
    chrome.notifications.clear('incoming_call');
    
    // Update badge
    chrome.action.setBadgeText({
        text: '',
        tabId: tab.id
    });
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    // Clean up any tab-specific data
    console.log('Tab closed:', tabId);
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Reset badge when page loads
        chrome.action.setBadgeText({
            text: '',
            tabId: tabId
        });
    }
});