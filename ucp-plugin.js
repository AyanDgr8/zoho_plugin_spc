// UCP Plugin JavaScript
class UCPPlugin {
    constructor() {
        this.showPopup = false;
        this.position = { x: 0, y: 0 };
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.ucpUrl = 'https://ucdemo.voicemeetme.com//ucp/login';
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        // Use a more robust initialization approach
        this.waitForElements().then(() => {
            this.bindEvents();
            this.setupMessageListener();
            this.isInitialized = true;
            
            // Auto-open UCP if needed (can be configured)
            const autoOpen = localStorage.getItem('ucp-auto-open') === 'true';
            if (autoOpen) {
                this.openPopup();
            }
        });
    }

    // Wait for required DOM elements to be available
    waitForElements() {
        return new Promise((resolve) => {
            const checkElements = () => {
                const popupContainer = document.getElementById('ucp-popup-container');
                const header = document.querySelector('.ucp-popup-header');
                
                if (popupContainer && header) {
                    resolve();
                } else {
                    // Check again after a short delay
                    setTimeout(checkElements, 100);
                }
            };
            checkElements();
        });
    }

    bindEvents() {
        const openBtn = document.getElementById('ucp-popup-btn');
        const minimizeBtn = document.getElementById('ucp-minimize-btn');
        const closeBtn = document.getElementById('ucp-close-btn');
        const popupContainer = document.getElementById('ucp-popup-container');
        const header = document.querySelector('.ucp-popup-header');

        if (openBtn) {
            openBtn.addEventListener('click', () => this.openPopup());
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizePopup();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePopup();
            });
        }

        // Bind drag events to the header specifically, not the entire container
        if (header) {
            header.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            header.addEventListener('dragstart', (e) => e.preventDefault()); // Prevent default drag
        }

        // Global mouse events for dragging - use capture phase for better reliability
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e), true);
        document.addEventListener('mouseup', () => this.handleMouseUp(), true);

        // Prevent dragging when interacting with iframe or buttons
        const iframe = document.getElementById('ucp-iframe');
        if (iframe) {
            iframe.addEventListener('mouseenter', () => {
                this.isDragging = false;
            });
        }

        // Ensure popup container has proper pointer events
        if (popupContainer) {
            popupContainer.style.pointerEvents = 'auto';
        }
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => this.handleUCPMessage(event), false);
    }

    openPopup() {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('ucp-hidden');
            this.showPopup = true;
            
            // Bring to front
            popupContainer.style.zIndex = '999999';
            
            // Save state
            localStorage.setItem('ucp-popup-open', 'true');
        }
    }

    minimizePopup() {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.add('ucp-hidden');
            this.showPopup = false;
            
            // Save state
            localStorage.setItem('ucp-popup-open', 'false');
        }
    }

    closePopup() {
        this.minimizePopup();
    }

    handleMouseDown(e) {
        // Only allow dragging from the header, but not from buttons
        if (e.target.closest('button')) {
            return;
        }
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer) return;

        this.isDragging = true;
        
        // Get current position from transform or default to center
        const currentTransform = popupContainer.style.transform;
        let currentX = 0, currentY = 0;
        
        if (currentTransform && currentTransform.includes('translate')) {
            const matches = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (matches) {
                currentX = parseFloat(matches[1]);
                currentY = parseFloat(matches[2]);
            }
        } else if (currentTransform === 'translate(-50%, -50%)' || !currentTransform) {
            // If centered or no transform, calculate center position
            const rect = popupContainer.getBoundingClientRect();
            currentX = (window.innerWidth - rect.width) / 2;
            currentY = (window.innerHeight - rect.height) / 2;
        }
        
        this.position = { x: currentX, y: currentY };
        this.startPos = {
            x: e.clientX - this.position.x,
            y: e.clientY - this.position.y
        };
        
        // Add dragging class and disable animations
        popupContainer.classList.add('ucp-dragging');
        popupContainer.style.transition = 'none';
        
        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        this.position = {
            x: e.clientX - this.startPos.x,
            y: e.clientY - this.startPos.y
        };
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            // Calculate boundaries to keep popup on screen
            const rect = popupContainer.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            this.position.x = Math.max(0, Math.min(this.position.x, maxX));
            this.position.y = Math.max(0, Math.min(this.position.y, maxY));
            
            // Apply transform without interfering with CSS animations
            popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
            popupContainer.style.left = '0';
            popupContainer.style.top = '0';
        }
        
        e.preventDefault();
    }

    handleMouseUp() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('ucp-dragging');
            // Re-enable transitions after a short delay
            setTimeout(() => {
                popupContainer.style.transition = '';
            }, 50);
        }
        
        // Save position
        localStorage.setItem('ucp-position', JSON.stringify(this.position));
    }

    handleUCPMessage(event) {
        // Verify origin for security - allow UCP server and Zoho domains
        const allowedOrigins = [
            new URL(this.ucpUrl).origin, // UCP server origin
            'https://crm.zoho.com',
            'https://crm.zoho.in', 
            'https://crm.zoho.eu',
            'https://zoho.com',
            'https://zoho.in',
            'https://zoho.eu'
        ];
        
        const isOriginAllowed = allowedOrigins.some(origin => 
            event.origin === origin || event.origin.endsWith('.zoho.com') || 
            event.origin.endsWith('.zoho.in') || event.origin.endsWith('.zoho.eu')
        );
        
        if (!isOriginAllowed) {
            console.warn('UCP Plugin: Received message from unauthorized origin:', event.origin);
            return;
        }

        try {
            const data = event.data;
            
            // Only process UCP-specific messages to avoid interference with other scripts
            if (!data || typeof data !== 'object' || !data.type || !data.type.startsWith('UCP_')) {
                return; // Ignore non-UCP messages
            }
            
            // Handle different message types
            switch (data.type) {
                case 'UCP_INCOMING_CALL':
                    console.info('UCP Plugin: Incoming call from queue:', data.payload?.queue_name);
                    this.handleIncomingCall(data.payload);
                    break;
                    
                case 'UCP_SESSION_CREATED':
                    console.info('UCP Plugin: Session created:', data.sessionId);
                    this.handleSessionCreated(data);
                    break;
                    
                case 'UCP_FULLSCREEN_CHANGE':
                    this.handleFullscreenChange(data.isFullscreen);
                    break;
                    
                case 'UCP_CALL_ENDED':
                    console.info('UCP Plugin: Call ended');
                    this.handleCallEnded(data);
                    break;
                    
                default:
                    console.info('UCP Plugin: Received message:', data);
            }
        } catch (error) {
            console.error('UCP Plugin: Error handling message:', error);
        }
    }

    handleIncomingCall(payload) {
        // Show the UCP window if minimized
        this.openPopup();
        
        // Bring window to front
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.style.zIndex = '999999';
        }
        
        // Show notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Incoming Call', {
                body: `Call from queue: ${payload?.queue_name || 'Unknown'}`,
                icon: '/icon.png'
            });
        }
        
        // Trigger custom event for other parts of the application
        window.dispatchEvent(new CustomEvent('ucpIncomingCall', {
            detail: payload
        }));
    }

    handleSessionCreated(data) {
        // Store session info
        localStorage.setItem('ucp-session-id', data.sessionId);
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('ucpSessionCreated', {
            detail: data
        }));
    }

    handleFullscreenChange(isFullscreen) {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer) return;
        
        if (isFullscreen) {
            popupContainer.style.width = '100vw';
            popupContainer.style.height = '100vh';
            popupContainer.style.transform = 'translate(0px, 0px)';
            popupContainer.style.left = '0';
            popupContainer.style.top = '0';
            this.position = { x: 0, y: 0 };
        } else {
            // Restore original size and position
            popupContainer.style.width = '400px';
            popupContainer.style.height = '600px';
            
            // Restore saved position or center
            const savedPosition = localStorage.getItem('ucp-position');
            if (savedPosition) {
                try {
                    this.position = JSON.parse(savedPosition);
                    popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
                    popupContainer.style.left = '0';
                    popupContainer.style.top = '0';
                } catch (e) {
                    // Fallback to center
                    popupContainer.style.transform = 'translate(-50%, -50%)';
                    popupContainer.style.left = '50%';
                    popupContainer.style.top = '50%';
                }
            } else {
                popupContainer.style.transform = 'translate(-50%, -50%)';
                popupContainer.style.left = '50%';
                popupContainer.style.top = '50%';
            }
        }
    }

    handleCallEnded(data) {
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('ucpCallEnded', {
            detail: data
        }));
    }

    // Public API methods
    show() {
        this.openPopup();
    }

    hide() {
        this.minimizePopup();
    }

    toggle() {
        if (this.showPopup) {
            this.minimizePopup();
        } else {
            this.openPopup();
        }
    }

    // Restore saved state
    restoreState() {
        if (!this.isInitialized) {
            // If not initialized yet, wait and try again
            setTimeout(() => this.restoreState(), 100);
            return;
        }
        
        const savedPosition = localStorage.getItem('ucp-position');
        const savedOpen = localStorage.getItem('ucp-popup-open');
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer) return;
        
        if (savedPosition) {
            try {
                this.position = JSON.parse(savedPosition);
                // Validate position is within screen bounds
                const maxX = window.innerWidth - 400; // popup width
                const maxY = window.innerHeight - 600; // popup height
                
                this.position.x = Math.max(0, Math.min(this.position.x, maxX));
                this.position.y = Math.max(0, Math.min(this.position.y, maxY));
                
                popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
                popupContainer.style.left = '0';
                popupContainer.style.top = '0';
            } catch (e) {
                console.warn('UCP Plugin: Failed to restore position:', e);
                // Reset to center on error
                popupContainer.style.transform = 'translate(-50%, -50%)';
                popupContainer.style.left = '50%';
                popupContainer.style.top = '50%';
            }
        }
        
        if (savedOpen === 'true') {
            this.openPopup();
        }
    }
}

// Initialize the plugin when DOM is ready with better timing
function initializeUCPPlugin() {
    if (window.ucpPlugin) {
        return; // Already initialized
    }
    
    window.ucpPlugin = new UCPPlugin();
    
    // Restore state after a short delay to ensure everything is ready
    setTimeout(() => {
        window.ucpPlugin.restoreState();
    }, 200);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUCPPlugin);
} else {
    initializeUCPPlugin();
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UCPPlugin;
}
