// UCP Plugin Content Script
(function() {
    'use strict';
    
    // Prevent multiple injections
    if (window.ucpPluginInjected) {
        return;
    }
    window.ucpPluginInjected = true;

    class UCPContentScript {
        constructor() {
            this.isInjected = false;
            this.ucpContainer = null;
            this.init();
        }

        init() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.injectUCP());
            } else {
                this.injectUCP();
            }

            // Listen for messages from background script
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                this.handleMessage(request, sender, sendResponse);
            });
        }

        async injectUCP() {
            if (this.isInjected) return;

            try {
                // Check if we should inject on this page
                if (!this.shouldInject()) {
                    return;
                }

                // Get the plugin HTML content
                const pluginUrl = chrome.runtime.getURL('ucp-plugin.html');
                const response = await fetch(pluginUrl);
                const htmlContent = await response.text();

                // Create container
                this.ucpContainer = document.createElement('div');
                this.ucpContainer.id = 'ucp-extension-container';
                this.ucpContainer.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999999;
                `;

                // Parse and inject HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const pluginContent = doc.body.innerHTML;
                
                this.ucpContainer.innerHTML = pluginContent;
                
                // Re-enable pointer events for interactive elements
                const interactiveElements = this.ucpContainer.querySelectorAll('button, iframe, .ucp-popup-container');
                interactiveElements.forEach(el => {
                    el.style.pointerEvents = 'auto';
                });

                // Inject into page
                document.body.appendChild(this.ucpContainer);

                // Load and execute the plugin JavaScript
                await this.loadPluginScript();

                this.isInjected = true;
                console.log('UCP Plugin injected successfully');

                // Notify background script
                chrome.runtime.sendMessage({
                    type: 'UCP_INJECTED',
                    url: window.location.href
                });

            } catch (error) {
                console.error('Failed to inject UCP plugin:', error);
            }
        }

        async loadPluginScript() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('ucp-plugin.js');
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        shouldInject() {
            const url = window.location.href.toLowerCase();
            
            // Inject on Zoho domains and localhost for testing
            const allowedDomains = [
                'zoho.com',
                'zoho.eu', 
                'zoho.in',
                'crm.zoho.com',
                'localhost',
                '127.0.0.1'
            ];

            // Skip if already injected or on excluded pages
            const excludedPaths = [
                '/login',
                '/logout',
                '/error'
            ];

            // Check domain
            const isDomainAllowed = allowedDomains.some(domain => url.includes(domain));
            
            // Check path exclusions
            const isPathExcluded = excludedPaths.some(path => url.includes(path));

            return isDomainAllowed && !isPathExcluded;
        }

        handleMessage(request, sender, sendResponse) {
            switch (request.type) {
                case 'TOGGLE_UCP':
                    this.toggleUCP();
                    sendResponse({ success: true });
                    break;

                case 'SHOW_UCP':
                    this.showUCP();
                    sendResponse({ success: true });
                    break;

                case 'HIDE_UCP':
                    this.hideUCP();
                    sendResponse({ success: true });
                    break;

                case 'GET_UCP_STATUS':
                    sendResponse({ 
                        injected: this.isInjected,
                        visible: this.isUCPVisible()
                    });
                    break;

                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        }

        toggleUCP() {
            if (window.ucpPlugin) {
                window.ucpPlugin.toggle();
            }
        }

        showUCP() {
            if (window.ucpPlugin) {
                window.ucpPlugin.show();
            }
        }

        hideUCP() {
            if (window.ucpPlugin) {
                window.ucpPlugin.hide();
            }
        }

        isUCPVisible() {
            const popup = document.getElementById('ucp-popup-container');
            return popup && !popup.classList.contains('ucp-hidden');
        }

        // Clean up when page unloads
        cleanup() {
            if (this.ucpContainer && this.ucpContainer.parentNode) {
                this.ucpContainer.parentNode.removeChild(this.ucpContainer);
            }
            this.isInjected = false;
        }
    }

    // Initialize the content script
    const ucpContentScript = new UCPContentScript();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        ucpContentScript.cleanup();
    });

    // Expose for debugging
    window.ucpContentScript = ucpContentScript;

})();