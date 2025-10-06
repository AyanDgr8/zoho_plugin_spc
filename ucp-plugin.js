// UCP Plugin JavaScript
class UCPPlugin {
    constructor() {
        this.showPopup = false;
        this.position = { x: 0, y: 0 };
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.ucpUrl = 'https://ira-spc-sj.ucprem.voicemeetme.com/ucp/login';
        this.isInitialized = false;
        this.dragTimeout = null;
        this.stateCheckInterval = null;
        this.lastInteractionTime = Date.now();
        this._dragRAF = null;
        this._lastPointer = null;
        
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
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e), true);
        window.addEventListener('mouseup', () => this.handleMouseUp(), true);
        
        // Add escape key handler to reset stuck states
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isDragging) {
                    this.forceResetDragState();
                } else {
                    // Even if not dragging, ensure all elements are clickable
                    this.ensurePointerEventsEnabled();
                }
            }
            
            // Emergency reset with Ctrl+Shift+R (or Cmd+Shift+R on Mac)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.emergencyReset();
            }
        });
        
        // Add window focus/blur handlers to reset stuck states
        window.addEventListener('focus', () => {
            this.forceResetDragState();
            this.ensurePointerEventsEnabled();
        });
        
        window.addEventListener('blur', () => {
            if (this.isDragging) {
                this.forceResetDragState();
            }
        });
        
        // Add visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isDragging) {
                this.forceResetDragState();
            }
        });
        
        // Add double-click handler to reset plugin state
        if (header) {
            header.addEventListener('dblclick', () => {
                this.resetPluginState();
            });
        }

        // Prevent dragging when interacting with iframe or buttons
        const iframe = document.getElementById('ucp-iframe');
        if (iframe) {
            iframe.addEventListener('mouseenter', () => {
                this.isDragging = false;
            });
            
            // Add iframe load event to ensure it's always interactive
            iframe.addEventListener('load', () => {
                this.ensureIframeInteractive();
                this.enhanceIframeInteractions();
            });
            
            // Monitor iframe for interaction issues
            iframe.addEventListener('click', (e) => {
                // If click doesn't work, force reset
                setTimeout(() => {
                    this.ensureIframeInteractive();
                }, 100);
            });
            
            // Enhanced mouse interaction monitoring
            iframe.addEventListener('mouseenter', () => {
                this.optimizeIframePerformance();
            });
            
            iframe.addEventListener('mousemove', this.throttle(() => {
                this.ensureIframeResponsive();
            }, 100));
            
            iframe.addEventListener('mouseleave', () => {
                this.resetIframeOptimizations();
            });
        }

        // Ensure popup container has proper pointer events
        if (popupContainer) {
            popupContainer.style.pointerEvents = 'auto';
        }
        
        // Initial call to ensure all elements are interactive
        setTimeout(() => {
            this.ensurePointerEventsEnabled();
            this.ensureIframeInteractive();
            // Start monitoring only if visible
            if (!popupContainer?.classList.contains('ucp-hidden')) {
                this.startStateMonitoring();
            }
        }, 100);
        
        // Additional iframe check after a longer delay
        setTimeout(() => {
            this.ensureIframeInteractive();
        }, 1000);
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

            // Resume monitoring when visible
            this.startStateMonitoring();
            this.ensurePointerEventsEnabled();
            this.ensureIframeInteractive();
        }
    }

    minimizePopup() {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.add('ucp-hidden');
            this.showPopup = false;
            
            // Save state
            localStorage.setItem('ucp-popup-open', 'false');

            // Stop monitoring to avoid work while hidden
            this.stopStateMonitoring();
            // Ensure drag state is cleared
            this.forceResetDragState();
            // Cancel any pending drag frame
            if (this._dragRAF) {
                cancelAnimationFrame(this._dragRAF);
                this._dragRAF = null;
            }
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
        this.lastInteractionTime = Date.now();
        
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
        
        // Set a timeout to automatically reset dragging state if it gets stuck
        this.dragTimeout = setTimeout(() => {
            if (this.isDragging) {
                console.warn('UCP Plugin: Drag state timeout, resetting...');
                this.forceResetDragState();
            }
        }, 5000); // 5 second timeout
        
        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        this.lastInteractionTime = Date.now();

        // Store latest pointer and schedule a frame if not already
        this._lastPointer = { x: e.clientX, y: e.clientY };
        if (this._dragRAF) return;

        this._dragRAF = requestAnimationFrame(() => {
            this._dragRAF = null;
            if (!this.isDragging || !this._lastPointer) return;

            this.position = {
                x: this._lastPointer.x - this.startPos.x,
                y: this._lastPointer.y - this.startPos.y
            };

            const popupContainer = document.getElementById('ucp-popup-container');
            if (popupContainer) {
                // Calculate boundaries to keep popup on screen
                const rect = popupContainer.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;

                this.position.x = Math.max(0, Math.min(this.position.x, maxX));
                this.position.y = Math.max(0, Math.min(this.position.y, maxY));

                // Apply transform efficiently within rAF
                popupContainer.style.transform = `translate(${this.position.x}px, ${this.position.y}px)`;
                popupContainer.style.left = '0';
                popupContainer.style.top = '0';
            }
        });

        e.preventDefault();
    }

    handleMouseUp() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Clear drag timeout
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }

        // Cancel any pending drag frame
        if (this._dragRAF) {
            cancelAnimationFrame(this._dragRAF);
            this._dragRAF = null;
        }
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('ucp-dragging');
            // Re-enable transitions after a short delay
            setTimeout(() => {
                popupContainer.style.transition = '';
                // Force re-enable pointer events for all children
                this.ensurePointerEventsEnabled();
                this.ensureIframeInteractive();
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

    // Force reset drag state if it gets stuck
    forceResetDragState() {
        this.isDragging = false;
        
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }
        
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.classList.remove('ucp-dragging');
            popupContainer.style.transition = '';
            this.ensurePointerEventsEnabled();
        }
    }
    
    // Ensure all interactive elements have proper pointer events
    ensurePointerEventsEnabled() {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer) return;
        if (popupContainer.classList.contains('ucp-hidden') || !this.showPopup) return;
        
        // Force remove dragging class if it exists
        popupContainer.classList.remove('ucp-dragging');
        
        // Re-enable pointer events for the container and all interactive elements
        popupContainer.style.pointerEvents = 'auto';
        
        const interactiveElements = popupContainer.querySelectorAll('iframe, button, input, select, textarea, [onclick], [onmousedown], [onmouseup], a, [tabindex]');
        interactiveElements.forEach(el => {
            el.style.pointerEvents = 'auto';
            // Also remove any inline styles that might disable interactions
            if (el.style.pointerEvents === 'none') {
                el.style.pointerEvents = 'auto';
            }
        });
        
        // Specifically ensure iframe is interactive
        this.ensureIframeInteractive();
        
        // Ensure header buttons are always clickable
        const headerButtons = popupContainer.querySelectorAll('.ucp-minimize-btn, .ucp-close-btn');
        headerButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
        });
        
        console.log('UCP Plugin: Pointer events re-enabled for all interactive elements');
    }
    
    // Dedicated method to ensure iframe is always interactive
    ensureIframeInteractive() {
        const iframe = document.getElementById('ucp-iframe');
        if (!iframe) return;
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer && (popupContainer.classList.contains('ucp-hidden') || !this.showPopup)) return;
        
        // Remove any emergency classes first
        iframe.classList.remove('ucp-iframe-emergency-reset');
        
        // Force enable all pointer events and interactions
        iframe.style.pointerEvents = 'auto';
        iframe.style.userSelect = 'auto';
        iframe.style.webkitUserSelect = 'auto';
        iframe.style.mozUserSelect = 'auto';
        iframe.style.msUserSelect = 'auto';
        iframe.style.zIndex = '1';
        iframe.style.opacity = '1';
        iframe.style.visibility = 'visible';
        
        // Remove any CSS classes that might interfere
        iframe.classList.remove('ucp-dragging');
        
        // Add emergency class for maximum override if needed
        iframe.classList.add('ucp-iframe-force-interactive');
        
        // Remove the force class after a moment to avoid conflicts
        setTimeout(() => {
            iframe.classList.remove('ucp-iframe-force-interactive');
        }, 500);
        
        console.log('UCP Plugin: Iframe interactions specifically restored');
    }
    
    // Enhanced iframe interaction methods
    enhanceIframeInteractions() {
        const iframe = document.getElementById('ucp-iframe');
        if (!iframe) return;
        
        // Add loading class during content load
        iframe.classList.add('ucp-iframe-loading');
        
        // Remove loading class after content is ready
        setTimeout(() => {
            iframe.classList.remove('ucp-iframe-loading');
        }, 1000);
        
        // Optimize iframe for smooth interactions
        iframe.style.willChange = 'contents';
        iframe.style.contain = 'layout';
        iframe.style.transform = 'translateZ(0)';
        
        console.log('UCP Plugin: Enhanced iframe interactions applied');
    }
    
    // Optimize iframe performance for better mouse interactions
    optimizeIframePerformance() {
        const iframe = document.getElementById('ucp-iframe');
        if (!iframe) return;
        
        // Enable hardware acceleration
        iframe.style.transform = 'translateZ(0)';
        iframe.style.willChange = 'contents, transform';
        
        // Ensure smooth cursor interactions
        iframe.style.cursor = 'auto';
        iframe.style.pointerEvents = 'auto';
        
        // Reduce input lag
        iframe.style.touchAction = 'auto';
    }
    
    // Ensure iframe remains responsive during interactions
    ensureIframeResponsive() {
        const iframe = document.getElementById('ucp-iframe');
        if (!iframe) return;
        
        // Check if iframe is still responsive
        const isResponsive = iframe.style.pointerEvents !== 'none';
        
        if (!isResponsive) {
            this.ensureIframeInteractive();
        }
        
        // Maintain smooth interactions
        iframe.style.transition = 'filter 0.2s ease, box-shadow 0.2s ease';
    }
    
    // Reset iframe optimizations when not in use
    resetIframeOptimizations() {
        const iframe = document.getElementById('ucp-iframe');
        if (!iframe) return;
        
        // Reset will-change to auto to save resources
        setTimeout(() => {
            iframe.style.willChange = 'auto';
        }, 1000);
    }
    
    // Throttle function for performance
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    // Emergency reset method with visual feedback
    emergencyReset() {
        console.log('UCP Plugin: Emergency reset activated!');
        const popupContainer = document.getElementById('ucp-popup-container');
        
        if (popupContainer) {
            // Add emergency reset class for maximum override
            popupContainer.classList.add('ucp-force-interactive');
            popupContainer.classList.remove('ucp-dragging');
            
            // Force reset all states
            this.isDragging = false;
            if (this.dragTimeout) {
                clearTimeout(this.dragTimeout);
                this.dragTimeout = null;
            }
            
            // Remove emergency class after a moment
            setTimeout(() => {
                popupContainer.classList.remove('ucp-force-interactive');
            }, 1000);
            
            this.showRecoveryNotification('Emergency reset completed');
        }
        
        this.ensurePointerEventsEnabled();
        this.ensureIframeInteractive();
        this.lastInteractionTime = Date.now();
    }
    
    // Add method to manually reset plugin state
    resetPluginState() {
        console.log('UCP Plugin: Manually resetting plugin state...');
        this.forceResetDragState();
        this.ensurePointerEventsEnabled();
        this.ensureIframeInteractive();
        
        // Reset any stuck states
        const popupContainer = document.getElementById('ucp-popup-container');
        if (popupContainer) {
            popupContainer.style.transform = popupContainer.style.transform || 'translate(-50%, -50%)';
            popupContainer.style.zIndex = '999999';
        }
        
        // Update last interaction time
        this.lastInteractionTime = Date.now();
    }
    
    // Start monitoring for stuck states
    startStateMonitoring() {
        // Clear any existing interval
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
        }
        
        // Check every 2 seconds for stuck states
        this.stateCheckInterval = setInterval(() => {
            this.checkForStuckStates();
        }, 2000);
    }
    
    stopStateMonitoring() {
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
            this.stateCheckInterval = null;
        }
    }
    
    // Check for and fix stuck states
    checkForStuckStates() {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer) return;
        if (popupContainer.classList.contains('ucp-hidden') || !this.showPopup) return;
        
        // Check if dragging state has been active too long
        if (this.isDragging && (Date.now() - this.lastInteractionTime) > 10000) {
            console.warn('UCP Plugin: Detected stuck drag state, auto-recovering...');
            this.forceResetDragState();
            this.showRecoveryNotification('Drag state reset automatically');
        }
        
        // Check if container has dragging class but isDragging is false
        if (popupContainer.classList.contains('ucp-dragging') && !this.isDragging) {
            console.warn('UCP Plugin: Detected stuck dragging class, removing...');
            popupContainer.classList.remove('ucp-dragging');
            this.ensurePointerEventsEnabled();
            this.ensureIframeInteractive();
            this.showRecoveryNotification('UI state recovered');
        }
        
        // Ensure critical elements are always interactive
        this.ensurePointerEventsEnabled();
        this.ensureIframeInteractive();
    }
    
    // Show a brief recovery notification
    showRecoveryNotification(message) {
        const popupContainer = document.getElementById('ucp-popup-container');
        if (!popupContainer || !this.showPopup) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        
        popupContainer.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Remove after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
    
    // Enhanced cleanup method
    cleanup() {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }
        
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
            this.stateCheckInterval = null;
        }
        
        this.forceResetDragState();
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

// Global functions for debugging/emergency use
window.resetUCPPlugin = function() {
    if (window.ucpPlugin) {
        window.ucpPlugin.resetPluginState();
        console.log('UCP Plugin state has been reset. Try interacting with the plugin now.');
    } else {
        console.warn('UCP Plugin not found. Make sure the plugin is loaded.');
    }
};

// Emergency reset function
window.emergencyResetUCPPlugin = function() {
    if (window.ucpPlugin) {
        window.ucpPlugin.emergencyReset();
        console.log('UCP Plugin emergency reset completed. All interactions should work now.');
    } else {
        console.warn('UCP Plugin not found. Make sure the plugin is loaded.');
    }
};

// Iframe-specific recovery function
window.fixUCPIframe = function() {
    if (window.ucpPlugin) {
        window.ucpPlugin.ensureIframeInteractive();
        console.log('UCP Plugin: Iframe interactions have been restored. Try clicking inside the iframe now.');
    } else {
        console.warn('UCP Plugin not found. Make sure the plugin is loaded.');
    }
};

// Optimize iframe interactions and hover effects
window.optimizeUCPInteractions = function() {
    if (window.ucpPlugin) {
        window.ucpPlugin.enhanceIframeInteractions();
        window.ucpPlugin.optimizeIframePerformance();
        console.log('UCP Plugin: Iframe interactions optimized for better mouse hover and clicking.');
    } else {
        console.warn('UCP Plugin not found. Make sure the plugin is loaded.');
    }
};

// Force iframe emergency reset
window.emergencyFixUCPIframe = function() {
    const iframe = document.getElementById('ucp-iframe');
    if (iframe) {
        // Add emergency reset class
        iframe.classList.add('ucp-iframe-emergency-reset');
        iframe.style.pointerEvents = 'auto';
        iframe.style.userSelect = 'auto';
        iframe.style.zIndex = '999';
        
        // Force refresh iframe interactions
        if (window.ucpPlugin) {
            window.ucpPlugin.ensureIframeInteractive();
        }
        
        console.log('UCP Plugin: Emergency iframe fix applied. Iframe should be clickable now.');
        
        // Remove emergency class after a moment
        setTimeout(() => {
            iframe.classList.remove('ucp-iframe-emergency-reset');
        }, 2000);
    } else {
        console.warn('UCP iframe not found.');
    }
};

// Help function to show available recovery methods
window.ucpPluginHelp = function() {
    console.log(`
UCP Plugin Recovery Methods:
1. Press Escape key while plugin is open
2. Double-click the plugin header
3. Press Ctrl+Shift+R (Cmd+Shift+R on Mac) for emergency reset
4. Run resetUCPPlugin() in console
5. Run emergencyResetUCPPlugin() in console
6. Run fixUCPIframe() in console (for iframe-specific issues)
7. Run emergencyFixUCPIframe() in console (for severe iframe issues)
8. Run optimizeUCPInteractions() in console (for better hover/click performance)
9. Switch browser tabs and come back
10. Wait 5-10 seconds for automatic recovery

EXTENSION CONTEXT ERRORS:
- If you see "Extension context invalidated" error:
  1. Refresh the current page (F5 or Ctrl+R)
  2. If that doesn't work, reload the extension in Chrome Extensions
  3. Then refresh the page again

If iframe content becomes unclickable, try methods 6-7 specifically.
If mouse hover/clicking feels sluggish, try method 8.
If plugin becomes unresponsive, try methods in order from 1-10.
    `);
};

// Function to check extension health
window.checkUCPExtensionHealth = function() {
    const checks = {
        extensionContext: !!(chrome?.runtime?.id),
        pluginInjected: !!window.ucpPlugin,
        containerExists: !!document.getElementById('ucp-popup-container'),
        iframeExists: !!document.getElementById('ucp-iframe')
    };
    
    console.log('UCP Extension Health Check:', checks);
    
    if (!checks.extensionContext) {
        console.error('❌ Extension context is invalid - please refresh the page');
    } else if (!checks.pluginInjected) {
        console.warn('⚠️ Plugin not injected - extension may need to be reloaded');
    } else if (!checks.containerExists) {
        console.warn('⚠️ Plugin container not found - injection may have failed');
    } else if (!checks.iframeExists) {
        console.warn('⚠️ Plugin iframe not found - HTML structure may be incomplete');
    } else {
        console.log('✅ All checks passed - UCP plugin appears healthy');
    }
    
    return checks;
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UCPPlugin;
}
