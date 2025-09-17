// UCP Plugin JavaScript
class UCPPlugin {
    constructor() {
        this.showPopup = false;
        this.position = { x: 0, y: 0 };
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.ucpUrl = 'https://ucdemo.voicemeetme.com//ucp/login';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupMessageListener();
        
        // Auto-open UCP if needed (can be configured)
        const autoOpen = localStorage.getItem('ucp-auto-open') === 'true';
        if (autoOpen) {
            this.openPopup();
        }
    }

    bindEvents() {
        const openBtn = document.getElementById('ucp-popup-btn');
        const minimizeBtn = document.getElementById('ucp-minimize-btn');
        const closeBtn = document.getElementById('ucp-close-btn');
        const popupContainer = document.getElementById('ucp-popup-container');

        if (openBtn) {
            openBtn.addEventListener('click', () => this.openPopup());
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.minimizePopup());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePopup());
        }

        if (popupContainer) {
            popupContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        }

        // Global mouse events for dragging
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());

        // Prevent dragging when interacting with iframe
        const iframe = document.getElementById('ucp-iframe');
        if (iframe) {
            iframe.addEventListener('mouseenter', () => {
                this.isDragging = false;
            });
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
        const header = e.target.closest('.ucp-popup-header');
        if (header && !e.target.closest('button')) {
            this.isDragging = true;
            this.startPos = {
                x: e.clientX - this.position.x,
                y: e.clientY - this.position.y
            };
            
            const popupContainer = document.getElementById('ucp-popup-container');
            if (popupContainer) {
                popupContainer.classList.add('ucp-dragging');
            }
            
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
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
                
                popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
                popupContainer.style.left = '0';
                popupContainer.style.top = '0';
            }
        }
    }

    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            
            const popupContainer = document.getElementById('ucp-popup-container');
            if (popupContainer) {
                popupContainer.classList.remove('ucp-dragging');
            }
            
            // Save position
            localStorage.setItem('ucp-position', JSON.stringify(this.position));
        }
    }

    handleUCPMessage(event) {
        // Verify origin for security
        if (event.origin !== new URL(this.ucpUrl).origin) {
            console.warn('UCP Plugin: Received message from unauthorized origin:', event.origin);
            return;
        }

        try {
            const data = event.data;
            
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
            popupContainer.style.transform = 'none';
            popupContainer.style.left = '0';
            popupContainer.style.top = '0';
            this.position = { x: 0, y: 0 };
        } else {
            // Restore original size
            popupContainer.style.width = '400px';
            popupContainer.style.height = '600px';
            popupContainer.style.transform = 'translate(-50%, -50%)';
            popupContainer.style.left = '50%';
            popupContainer.style.top = '50%';
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
        const savedPosition = localStorage.getItem('ucp-position');
        const savedOpen = localStorage.getItem('ucp-popup-open');
        
        if (savedPosition) {
            try {
                this.position = JSON.parse(savedPosition);
                const popupContainer = document.getElementById('ucp-popup-container');
                if (popupContainer) {
                    popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
                    popupContainer.style.left = '0';
                    popupContainer.style.top = '0';
                }
            } catch (e) {
                console.warn('UCP Plugin: Failed to restore position:', e);
            }
        }
        
        if (savedOpen === 'true') {
            this.openPopup();
        }
    }
}

// Initialize the plugin when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ucpPlugin = new UCPPlugin();
        window.ucpPlugin.restoreState();
    });
} else {
    window.ucpPlugin = new UCPPlugin();
    window.ucpPlugin.restoreState();
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UCPPlugin;
}
