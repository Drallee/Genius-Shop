        let items = [];
        let itemIdCounter = 0;
        let loadedGuiShops = []; // Store all shops from gui.yml
        let originalGuiYaml = ''; // Store original gui.yml to preserve structure
        let mainMenuTitle = '&8Shop Menu'; // Main menu title
        let mainMenuRows = 3; // Main menu rows
        let isLoadingFiles = true; // Flag to prevent saving during initial load

        // Activity log storage
        let activityLog = [];
        const ACTIVITY_LOG_KEY = 'shop-activity-log';
        let currentViewedEntry = null; // Track the entry being viewed for rollback
        let unsavedChanges = []; // Track changes since last save

        // Load activity log from localStorage
        function loadActivityLog() {
            try {
                const saved = localStorage.getItem(ACTIVITY_LOG_KEY);
                if (saved) {
                    activityLog = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to load activity log:', e);
                activityLog = [];
            }
        }

        // Save activity log to localStorage
        function saveActivityLog() {
            try {
                localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
            } catch (e) {
                console.error('Failed to save activity log:', e);
            }
        }

        // Add activity entry
        function addActivityEntry(action, target, beforeData, afterData, details = {}) {
            const entry = {
                id: Date.now() + Math.random(),
                timestamp: new Date().toISOString(),
                username: currentUsername || 'Unknown',
                action: action, // 'created', 'updated', 'deleted'
                target: target, // 'shop-item', 'main-menu-button', 'purchase-menu', 'sell-menu', 'shop-file'
                beforeData: beforeData,
                afterData: afterData,
                details: details
            };
            activityLog.unshift(entry); // Add to beginning

            // Keep only last 100 entries
            if (activityLog.length > 100) {
                activityLog = activityLog.slice(0, 100);
            }

            saveActivityLog();

            // Track as unsaved change
            unsavedChanges.push({
                action: action,
                target: target,
                description: getActivitySummary(entry)
            });
        }

        // ===== UNIVERSAL MODAL FUNCTIONS =====

        // Custom alert function
        function showAlert(message, type = 'info') {
            const modal = document.getElementById('alert-modal');
            const icon = document.getElementById('alert-modal-icon');
            const titleText = document.getElementById('alert-modal-title-text');
            const content = document.getElementById('alert-modal-content');

            // Set icon and title based on type
            if (type === 'error') {
                icon.textContent = '❌';
                titleText.textContent = 'Error';
                modal.querySelector('div[style*="border: 1px solid"]').style.borderColor = 'rgba(255, 107, 107, 0.3)';
            } else if (type === 'success') {
                icon.textContent = '✅';
                titleText.textContent = 'Success';
                modal.querySelector('div[style*="border: 1px solid"]').style.borderColor = 'rgba(0, 230, 118, 0.3)';
            } else if (type === 'warning') {
                icon.textContent = '⚠️';
                titleText.textContent = 'Warning';
                modal.querySelector('div[style*="border: 1px solid"]').style.borderColor = 'rgba(255, 215, 0, 0.3)';
            } else {
                icon.textContent = 'ℹ️';
                titleText.textContent = 'Message';
                modal.querySelector('div[style*="border: 1px solid"]').style.borderColor = 'rgba(120, 119, 198, 0.3)';
            }

            content.textContent = message;

            const animationsDisabled = document.body.classList.contains('no-animations');
            modal.style.display = 'flex';

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            } else if (modalBox) {
                modalBox.style.animation = 'none';
            }
        }

        function closeAlertModal() {
            const modal = document.getElementById('alert-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            } else {
                modal.style.display = 'none';
            }
        }

        // Custom confirm function
        let confirmCallback = null;

        function showConfirm(message) {
            return new Promise((resolve) => {
                const modal = document.getElementById('confirm-modal');
                const content = document.getElementById('confirm-modal-content');

                content.textContent = message;
                confirmCallback = resolve;

                const animationsDisabled = document.body.classList.contains('no-animations');
                modal.style.display = 'flex';

                const modalBox = modal.querySelector('div[style*="background"]');
                if (modalBox && !animationsDisabled) {
                    modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                } else if (modalBox) {
                    modalBox.style.animation = 'none';
                }
            });
        }

        function closeConfirmModal(result) {
            const modal = document.getElementById('confirm-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                    if (confirmCallback) {
                        confirmCallback(result);
                        confirmCallback = null;
                    }
                }, 300);
            } else {
                modal.style.display = 'none';
                if (confirmCallback) {
                    confirmCallback(result);
                    confirmCallback = null;
                }
            }
        }

        // Performance optimization: debounce function
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Performance optimization: throttle function
        function throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // Transaction settings
        let transactionSettings = {
            purchase: {
                displayMaterial: 'BOOK',
                titlePrefix: '&8Buying ',
                displaySlot: 22,
                maxAmount: 2304,
                buttons: {
                    confirm: { material: 'LIME_STAINED_GLASS', name: '&aCONFIRM PURCHASE', slot: 39 },
                    cancel: { material: 'RED_STAINED_GLASS', name: '&cCancel', slot: 41 },
                    back: { material: 'ENDER_CHEST', name: '&9Back', slot: 40 }
                },
                add: {
                    material: 'LIME_STAINED_GLASS_PANE',
                    buttons: {
                        '1': { name: '&aAdd 1', slot: 24 },
                        '10': { name: '&aAdd 10', slot: 25 }
                    }
                },
                remove: {
                    material: 'RED_STAINED_GLASS_PANE',
                    buttons: {
                        '1': { name: '&cRemove 1', slot: 20 },
                        '10': { name: '&cRemove 10', slot: 19 }
                    }
                },
                set: {
                    material: 'YELLOW_STAINED_GLASS_PANE',
                    buttons: {
                        '64': { name: '&aSet to 64', slot: 26 },
                        '1': { name: '&cSet to 1', slot: 18 }
                    }
                }
            },
            sell: {
                displayMaterial: 'BOOK',
                titlePrefix: '&8Selling ',
                displaySlot: 22,
                maxAmount: 2304,
                buttons: {
                    confirm: { material: 'LIME_STAINED_GLASS', name: '&aCONFIRM SELL', slot: 48 },
                    sellAll: { material: 'GOLD_BLOCK', name: '&6SELL ALL', slot: 40 },
                    cancel: { material: 'RED_STAINED_GLASS', name: '&cCancel', slot: 50 },
                    back: { material: 'ENDER_CHEST', name: '&9Back', slot: 49 }
                },
                add: {
                    material: 'LIME_STAINED_GLASS_PANE',
                    buttons: {
                        '1': { name: '&aAdd 1', slot: 24 },
                        '10': { name: '&aAdd 10', slot: 25 }
                    }
                },
                remove: {
                    material: 'RED_STAINED_GLASS_PANE',
                    buttons: {
                        '1': { name: '&cRemove 1', slot: 20 },
                        '10': { name: '&cRemove 10', slot: 19 }
                    }
                },
                set: {
                    material: 'YELLOW_STAINED_GLASS_PANE',
                    buttons: {
                        '64': { name: '&aSet to 64', slot: 26 },
                        '1': { name: '&cSet to 1', slot: 18 }
                    }
                }
            }
        };

        // API Configuration - dynamically determine based on how page was accessed
        const API_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '8080'}`;
        let sessionToken = localStorage.getItem('sessionToken');
        let username = localStorage.getItem('username');
        let currentUsername = username; // For activity log

        let currentShopFile = 'blocks.yml'; // Current shop being edited
        let currentTab = 'mainmenu'; // Track current active tab
        let allShops = {}; // Store all loaded shops
        let autoSaveTimeout = null;
        let isSaving = false;
        let currentPreviewPage = 0; // Current page being previewed

        // Modal state
        let currentModalData = null;

        // Minecraft texture API base URL
        const TEXTURE_API = 'https://mc.nerothe.com/img/1.21.8/minecraft_';

        // Initialize animations toggle from localStorage
        const animationsEnabled = localStorage.getItem('animationsEnabled') !== 'false'; // default true
        const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false'; // default true

        function toggleAnimations() {
            const toggle = document.getElementById('animations-toggle');
            const enabled = toggle.checked;

            if (enabled) {
                document.body.classList.remove('no-animations');
                localStorage.setItem('animationsEnabled', 'true');
            } else {
                document.body.classList.add('no-animations');
                localStorage.setItem('animationsEnabled', 'false');
            }
        }

        function toggleAutoSave() {
            const toggle = document.getElementById('auto-save-toggle');
            const enabled = toggle.checked;
            localStorage.setItem('autoSaveEnabled', enabled ? 'true' : 'false');
        }

        // Initialize
        console.log('[SHOP EDITOR] Script loaded');

        document.addEventListener('DOMContentLoaded', async function() {
            console.log('[SHOP EDITOR] DOM Content Loaded');

            // Setup animations toggle
            const animationsToggle = document.getElementById('animations-toggle');
            if (animationsToggle) {
                animationsToggle.checked = animationsEnabled;
                if (!animationsEnabled) {
                    document.body.classList.add('no-animations');
                }
                animationsToggle.addEventListener('change', toggleAnimations);
            }

            // Setup auto-save toggle
            const autoSaveToggle = document.getElementById('auto-save-toggle');
            if (autoSaveToggle) {
                autoSaveToggle.checked = autoSaveEnabled;
                autoSaveToggle.addEventListener('change', toggleAutoSave);
            }

            // Setup mobile toggles - sync with desktop toggles
            const animationsToggleMobile = document.getElementById('animations-toggle-mobile');
            const autoSaveToggleMobile = document.getElementById('auto-save-toggle-mobile');

            if (animationsToggleMobile) {
                animationsToggleMobile.checked = animationsEnabled;
                animationsToggleMobile.addEventListener('change', function() {
                    // Sync with desktop toggle
                    if (animationsToggle) {
                        animationsToggle.checked = this.checked;
                        toggleAnimations();
                    }
                });
            }

            if (autoSaveToggleMobile) {
                autoSaveToggleMobile.checked = autoSaveEnabled;
                autoSaveToggleMobile.addEventListener('change', function() {
                    // Sync with desktop toggle
                    if (autoSaveToggle) {
                        autoSaveToggle.checked = this.checked;
                        toggleAutoSave();
                    }
                });
            }

            // Sync desktop toggles to mobile toggles
            if (animationsToggle && animationsToggleMobile) {
                const originalAnimationsToggle = animationsToggle.onchange;
                animationsToggle.addEventListener('change', function() {
                    animationsToggleMobile.checked = this.checked;
                });
            }

            if (autoSaveToggle && autoSaveToggleMobile) {
                const originalAutoSaveToggle = autoSaveToggle.onchange;
                autoSaveToggle.addEventListener('change', function() {
                    autoSaveToggleMobile.checked = this.checked;
                });
            }

            // Debug: Log current URL and API_URL
            console.log('[SHOP EDITOR] Current URL:', window.location.href);
            console.log('[SHOP EDITOR] API_URL:', API_URL);
            console.log('[SHOP EDITOR] Search params:', window.location.search);

            // Check for auto-login token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const autoLoginToken = urlParams.get('token');

            console.log('[SHOP EDITOR] Auto-login token found:', autoLoginToken ? 'YES (' + autoLoginToken.substring(0, 8) + '...)' : 'NO');

            if (autoLoginToken) {
                // Show loading message
                document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 24px;">🔐 Logging in...</div><div style="font-size: 14px; color: #888;">Please wait</div></div>';

                // Attempt auto-login
                try {
                    console.log('Attempting auto-login with token:', autoLoginToken.substring(0, 8) + '...');
                    const response = await fetch(`${API_URL}/api/autologin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ token: autoLoginToken })
                    });

                    console.log('Auto-login response status:', response.status);

                    if (response.ok) {
                        const data = await response.json();
                        console.log('Auto-login successful for user:', data.username);
                        sessionToken = data.sessionToken;
                        username = data.username;
                        currentUsername = username;
                        localStorage.setItem('sessionToken', sessionToken);
                        localStorage.setItem('username', username);

                        // Remove token from URL and reload
                        window.history.replaceState({}, document.title, window.location.pathname);
                        window.location.reload();
                    } else {
                        const error = await response.json();
                        console.error('Auto-login failed:', error);

                        // Check if this is a pending confirmation (IP bypass)
                        if (response.status === 403 && error.status === 'pending_confirmation') {
                            console.log('Login pending confirmation - showing waiting screen');

                            // Show waiting for confirmation screen
                            document.body.innerHTML = `
                                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 25px; padding: 40px; text-align: center;">
                                    <div style="font-size: 48px; animation: pulse 2s ease-in-out infinite;">⚠️</div>
                                    <div style="font-size: 28px; font-weight: 700;">Security Confirmation Required</div>
                                    <div style="font-size: 16px; color: #aaa; max-width: 500px; line-height: 1.6;">
                                        You are logging in from a different IP address.<br>
                                        Please check your Minecraft game and confirm the login request.
                                    </div>
                                    <div style="margin-top: 20px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                                        <div style="font-size: 14px; color: #888; margin-bottom: 8px;">Waiting for confirmation...</div>
                                        <div style="font-size: 12px; color: #666;">This will retry automatically</div>
                                    </div>
                                    <div id="countdown" style="font-size: 14px; color: #666; margin-top: 10px;">Retrying in <span id="timer">10</span>s</div>
                                    <style>
                                        @keyframes pulse {
                                            0%, 100% { transform: scale(1); opacity: 1; }
                                            50% { transform: scale(1.1); opacity: 0.8; }
                                        }
                                    </style>
                                </div>
                            `;

                            // Poll for confirmation
                            let attempts = 0;
                            const maxAttempts = 36; // 3 minutes (36 * 5 seconds)
                            let countdown = 10;

                            const countdownInterval = setInterval(() => {
                                countdown--;
                                const timerEl = document.getElementById('timer');
                                if (timerEl) timerEl.textContent = countdown;
                                if (countdown <= 0) countdown = 10;
                            }, 1000);

                            const pollInterval = setInterval(async () => {
                                attempts++;
                                if (attempts > maxAttempts) {
                                    clearInterval(pollInterval);
                                    clearInterval(countdownInterval);
                                    alert('Confirmation timeout. Please try logging in again.');
                                    window.location.href = 'login.html';
                                    return;
                                }

                                try {
                                    console.log('Polling for confirmation (attempt ' + attempts + ')...');
                                    const retryResponse = await fetch(`${API_URL}/api/autologin`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ token: autoLoginToken })
                                    });

                                    if (retryResponse.ok) {
                                        clearInterval(pollInterval);
                                        clearInterval(countdownInterval);
                                        const data = await retryResponse.json();
                                        console.log('Login confirmed! User:', data.username);
                                        sessionToken = data.sessionToken;
                                        username = data.username;
                                        currentUsername = username;
                                        localStorage.setItem('sessionToken', sessionToken);
                                        localStorage.setItem('username', username);

                                        // Show success and reload
                                        document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 48px;">✓</div><div style="font-size: 24px; color: #4ade80;">Login Confirmed!</div><div style="font-size: 14px; color: #888;">Redirecting...</div></div>';

                                        setTimeout(() => {
                                            window.history.replaceState({}, document.title, window.location.pathname);
                                            window.location.reload();
                                        }, 1500);
                                    } else {
                                        const retryError = await retryResponse.json();
                                        // If still pending, continue polling
                                        if (retryError.status !== 'pending_confirmation') {
                                            // Something else went wrong, stop polling
                                            clearInterval(pollInterval);
                                            clearInterval(countdownInterval);
                                            console.error('Login failed:', retryError);
                                            alert('Login failed: ' + (retryError.error || 'Unknown error'));
                                            window.location.href = 'login.html';
                                        }
                                    }
                                } catch (err) {
                                    console.error('Poll error:', err);
                                    // Continue polling on network errors
                                }
                            }, 5000); // Poll every 5 seconds

                            return;
                        }

                        showAlert('Auto-login failed: ' + (error.error || 'Unknown error') + '\n\nPlease check:\n- You are online in Minecraft\n- You have admin permission\n- Token has not expired (5 min)\n- You are accessing from the same network', 'error');
                        setTimeout(() => window.location.href = 'login.html', 2000);

                        return;
                    }
                } catch (error) {
                    console.error('Auto-login error:', error);
                    showAlert('Failed to connect to server.\n\nError: ' + error.message + '\n\nPlease check:\n- API server is running\n- You can access the server URL\n- Firewall is not blocking the connection');
                    window.location.href = 'login.html';
                    return;
                }
            }

            // Check authentication
            if (!sessionToken || !username) {
                window.location.href = 'login.html';
                return;
            }

            // Display username with Minecraft head
            const userInfoEl = document.getElementById('user-info');
            userInfoEl.innerHTML = `
                <img src="https://mc-heads.net/avatar/${username}/24"
                     alt="${username}"
                     style="width: 24px; height: 24px; border-radius: 4px; image-rendering: pixelated; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                <span style="display: none;">👤</span>
                <span>${username}</span>
            `;

            // Hide page navigation initially (it's for shop tab only)
            document.getElementById('page-navigation').style.display = 'none';

            generatePreviewGrid();
            loadAllFiles(); // Auto-load files from server

            // Initialize main menu preview
            updateGuiPreview();

            // Load activity log
            loadActivityLog();
        });

        function logout() {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            const backdrop = document.getElementById('mobile-menu-backdrop');
            const toggleBtn = document.getElementById('mobile-menu-toggle');

            menu.classList.toggle('active');
            backdrop.classList.toggle('active');
            toggleBtn.classList.toggle('active');

            // Prevent body scrolling when menu is open
            if (menu.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }

        function updateSaveStatus(message, color = '#aaa') {
            const statusEl = document.getElementById('save-status');
            statusEl.textContent = message;
            statusEl.style.color = color;
        }

        function manualSave() {
            if (isSaving) return;

            // Show modal with changes
            openSaveConfirmationModal();
        }

        function openSaveConfirmationModal() {
            const modal = document.getElementById('save-confirmation-modal');
            const content = document.getElementById('save-confirmation-content');

            let html = '';

            if (unsavedChanges.length > 0) {
                html = `
                    <div style="background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(255, 215, 0, 0.2);">
                        <p style="color: rgba(220, 230, 245, 0.95); margin: 0 0 16px 0; font-size: 1em;">
                            You are about to save <strong style="color: #ffd700;">${unsavedChanges.length} change${unsavedChanges.length > 1 ? 's' : ''}</strong> to the server:
                        </p>
                    </div>

                    <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                        ${unsavedChanges.map((change, index) => {
                            const icon = change.action === 'created' ? '➕' : change.action === 'updated' ? '✏️' : '🗑️';
                            const color = change.action === 'created' ? 'rgba(0, 230, 118, 0.2)' : change.action === 'updated' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 107, 107, 0.2)';
                            const borderColor = change.action === 'created' ? 'rgba(0, 230, 118, 0.3)' : change.action === 'updated' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 107, 107, 0.3)';

                            return `
                                <div style="background: ${color}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">
                                    <span style="font-size: 1.5em; flex-shrink: 0;">${icon}</span>
                                    <div style="flex: 1;">
                                        <div style="color: rgba(200, 210, 225, 0.7); font-size: 0.75em; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">${change.action}</div>
                                        <div style="color: rgba(220, 230, 245, 0.95); font-size: 0.9em;">${change.description}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 10px; padding: 14px; margin-top: 20px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: rgba(255, 215, 0, 0.95);">
                            <span style="font-size: 1.2em;">⚠️</span>
                            <span style="font-size: 0.9em; font-weight: 600;">Are you sure you want to save these changes?</span>
                        </div>
                    </div>
                `;
            } else {
                html = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 3em; margin-bottom: 16px; opacity: 0.7;">💾</div>
                        <p style="color: rgba(220, 230, 245, 0.95); margin: 0; font-size: 1.1em;">
                            Save current configuration to server?
                        </p>
                        <p style="color: rgba(180, 190, 210, 0.7); margin: 12px 0 0 0; font-size: 0.9em;">
                            No tracked changes detected, but you can still force a save.
                        </p>
                    </div>
                `;
            }

            content.innerHTML = html;

            const animationsDisabled = document.body.classList.contains('no-animations');
            modal.style.display = 'flex';

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            } else if (modalBox) {
                modalBox.style.animation = 'none';
            }
        }

        function closeSaveConfirmationModal() {
            const modal = document.getElementById('save-confirmation-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            } else {
                modal.style.display = 'none';
            }
        }

        async function confirmSave() {
            closeSaveConfirmationModal();

            updateSaveStatus('Saving...', '#ffaa00');
            await saveCurrentShop();

            // Clear unsaved changes after successful save
            unsavedChanges = [];

            updateSaveStatus('✓ Saved', '#55ff55');

            setTimeout(() => {
                updateSaveStatus('');
            }, 2000);
        }

        function switchTab(tabName) {
            currentTab = tabName; // Track current tab

            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');

            // Get page navigation element
            const pageNav = document.getElementById('page-navigation');

            if (tabName === 'mainmenu') {
                renderMainMenuShops();
                updateGuiPreview();
                pageNav.style.display = 'none';
            } else if (tabName === 'shop') {
                updatePreview();
                // Page navigation visibility is controlled by updatePreview()
            } else if (tabName === 'purchase') {
                pageNav.style.display = 'none';
                renderPurchaseButtons();
                updatePurchasePreview();
            } else if (tabName === 'sell') {
                pageNav.style.display = 'none';
                renderSellButtons();
                updateSellPreview();
            }
        }

        function switchShop(filename) {
            // Save current shop before switching
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
                saveCurrentShop();
            }

            // Reset to first page
            currentPreviewPage = 0;

            // Load the new shop
            loadShopFromData(filename);
        }

        function createNewShop() {
            const shopName = prompt('Enter new shop filename (without .yml):\nExample: custom_shop');
            if (!shopName || !shopName.trim()) return;

            const filename = shopName.trim().replace(/\.yml$/, '') + '.yml';

            // Check if shop already exists
            if (allShops[filename]) {
                showAlert('A shop with this name already exists!', 'warning');
                return;
            }

            // Save current shop before switching
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
                saveCurrentShop();
            }

            // Create new empty shop
            currentShopFile = filename;
            items = [];
            itemIdCounter = 0;
            currentPreviewPage = 0;

            // Set default values
            document.getElementById('gui-name').value = '&8' + shopName.replace(/_/g, ' ');
            document.getElementById('rows').value = 3;
            document.getElementById('permission').value = '';
            document.getElementById('available-times').value = '';

            // Add to allShops
            allShops[filename] = '';

            // Add to dropdown
            const shopSelector = document.getElementById('shop-selector');
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            shopSelector.appendChild(option);
            shopSelector.value = filename;

            // Update UI
            renderItems();
            updateAll();

            // Save the new shop
            saveCurrentShop();

            // Log creation
            addActivityEntry('created', 'shop-file', null, { filename: filename, guiName: document.getElementById('gui-name').value }, { filename: filename });

            showAlert('New shop "' + filename + '" created! You can now add items to it.', 'success');
        }

        function openShopSettings() {
            const guiName = document.getElementById('gui-name').value;
            const rows = document.getElementById('rows').value;
            const permission = document.getElementById('permission').value;
            const availableTimes = document.getElementById('available-times').value;
            const showBuyPrice = document.getElementById('shop-show-buy-price').checked;
            const buyPriceLine = document.getElementById('shop-buy-price-line').value;
            const showSellPrice = document.getElementById('shop-show-sell-price').checked;
            const sellPriceLine = document.getElementById('shop-sell-price-line').value;
            const showBuyHint = document.getElementById('shop-show-buy-hint').checked;
            const buyHintLine = document.getElementById('shop-buy-hint-line').value;
            const showSellHint = document.getElementById('shop-show-sell-hint').checked;
            const sellHintLine = document.getElementById('shop-sell-hint-line').value;

            openEditModal({
                type: 'shop-settings',
                title: '⚙️ Shop Settings',
                fields: [
                    { label: 'GUI Title (use & for colors)', id: 'modal-gui-name', type: 'text', value: guiName },
                    { label: 'Rows (1-5)', id: 'modal-rows', type: 'number', value: rows, min: 1, max: 5 },
                    { label: 'Permission (optional)', id: 'modal-permission', type: 'text', value: permission },
                    { label: 'Available Times (optional, one per line)', id: 'modal-available-times', type: 'textarea', value: availableTimes, hint: 'Time ranges • Day ranges • Date ranges' },
                    { label: 'Show Buy Price', id: 'modal-show-buy-price', type: 'checkbox', value: showBuyPrice },
                    { label: 'Buy Price Line (use & for colors)', id: 'modal-buy-price-line', type: 'text', value: buyPriceLine, hint: 'Use %price% for item price' },
                    { label: 'Show Sell Price', id: 'modal-show-sell-price', type: 'checkbox', value: showSellPrice },
                    { label: 'Sell Price Line (use & for colors)', id: 'modal-sell-price-line', type: 'text', value: sellPriceLine, hint: 'Use %sell-price% for sell price' },
                    { label: 'Show Buy Hint', id: 'modal-show-buy-hint', type: 'checkbox', value: showBuyHint },
                    { label: 'Buy Hint Line (use & for colors)', id: 'modal-buy-hint-line', type: 'text', value: buyHintLine, hint: 'Use %price% for item price' },
                    { label: 'Show Sell Hint', id: 'modal-show-sell-hint', type: 'checkbox', value: showSellHint },
                    { label: 'Sell Hint Line (use & for colors)', id: 'modal-sell-hint-line', type: 'text', value: sellHintLine, hint: 'Use %sell-price% for sell price' }
                ],
                onSave: (data) => {
                    // Capture before state
                    const beforeData = {
                        guiName: guiName,
                        rows: rows,
                        permission: permission,
                        availableTimes: availableTimes,
                        showBuyPrice: showBuyPrice,
                        buyPriceLine: buyPriceLine,
                        showSellPrice: showSellPrice,
                        sellPriceLine: sellPriceLine,
                        showBuyHint: showBuyHint,
                        buyHintLine: buyHintLine,
                        showSellHint: showSellHint,
                        sellHintLine: sellHintLine
                    };

                    document.getElementById('gui-name').value = data['modal-gui-name'];
                    document.getElementById('rows').value = data['modal-rows'];
                    document.getElementById('permission').value = data['modal-permission'];
                    document.getElementById('available-times').value = data['modal-available-times'];
                    document.getElementById('shop-show-buy-price').checked = data['modal-show-buy-price'];
                    document.getElementById('shop-buy-price-line').value = data['modal-buy-price-line'];
                    document.getElementById('shop-show-sell-price').checked = data['modal-show-sell-price'];
                    document.getElementById('shop-sell-price-line').value = data['modal-sell-price-line'];
                    document.getElementById('shop-show-buy-hint').checked = data['modal-show-buy-hint'];
                    document.getElementById('shop-buy-hint-line').value = data['modal-buy-hint-line'];
                    document.getElementById('shop-show-sell-hint').checked = data['modal-show-sell-hint'];
                    document.getElementById('shop-sell-hint-line').value = data['modal-sell-hint-line'];

                    // Capture after state
                    const afterData = {
                        guiName: data['modal-gui-name'],
                        rows: data['modal-rows'],
                        permission: data['modal-permission'],
                        availableTimes: data['modal-available-times'],
                        showBuyPrice: data['modal-show-buy-price'],
                        buyPriceLine: data['modal-buy-price-line'],
                        showSellPrice: data['modal-show-sell-price'],
                        sellPriceLine: data['modal-sell-price-line'],
                        showBuyHint: data['modal-show-buy-hint'],
                        buyHintLine: data['modal-buy-hint-line'],
                        showSellHint: data['modal-show-sell-hint'],
                        sellHintLine: data['modal-sell-hint-line']
                    };

                    // Log the update
                    addActivityEntry('updated', 'shop-settings', beforeData, afterData, { shopFile: currentShopFile });

                    updateAll();
                }
            });
        }

        function openMainMenuSettings() {
            const title = document.getElementById('mainmenu-title').value;
            const rows = document.getElementById('mainmenu-rows').value;

            openEditModal({
                type: 'mainmenu-settings',
                title: '⚙️ Main Menu Settings',
                fields: [
                    { label: 'Title (use & for colors)', id: 'modal-mainmenu-title', type: 'text', value: title },
                    { label: 'Rows (1-6)', id: 'modal-mainmenu-rows', type: 'number', value: rows, min: 1, max: 6 }
                ],
                onSave: (data) => {
                    // Capture before state
                    const beforeData = {
                        title: title,
                        rows: rows
                    };

                    document.getElementById('mainmenu-title').value = data['modal-mainmenu-title'];
                    document.getElementById('mainmenu-rows').value = data['modal-mainmenu-rows'];

                    // Capture after state
                    const afterData = {
                        title: data['modal-mainmenu-title'],
                        rows: data['modal-mainmenu-rows']
                    };

                    // Log the update
                    addActivityEntry('updated', 'mainmenu-settings', beforeData, afterData);

                    updateMainMenuConfig();
                }
            });
        }

        function openPurchaseSettings() {
            const maxAmount = document.getElementById('purchase-max-amount').value;
            const titlePrefix = document.getElementById('purchase-title-prefix').value;
            const addMaterial = transactionSettings.purchase.add.material;
            const removeMaterial = transactionSettings.purchase.remove.material;
            const setMaterial = transactionSettings.purchase.set.material;

            openEditModal({
                type: 'purchase-settings',
                title: '⚙️ Purchase Menu Settings',
                fields: [
                    { label: 'Title Prefix (use & for colors)', id: 'modal-title-prefix', type: 'text', value: titlePrefix },
                    { label: 'Max Amount', id: 'modal-purchase-max', type: 'number', value: maxAmount, hint: 'Maximum items per purchase' },
                    { label: 'ADD Buttons Material', id: 'modal-add-material', type: 'text', value: addMaterial, hint: 'Material for all ADD buttons' },
                    { label: 'REMOVE Buttons Material', id: 'modal-remove-material', type: 'text', value: removeMaterial, hint: 'Material for all REMOVE buttons' },
                    { label: 'SET Buttons Material', id: 'modal-set-material', type: 'text', value: setMaterial, hint: 'Material for all SET buttons' }
                ],
                onSave: (data) => {
                    // Capture before state
                    const beforeData = {
                        maxAmount: maxAmount,
                        titlePrefix: titlePrefix,
                        addMaterial: addMaterial,
                        removeMaterial: removeMaterial,
                        setMaterial: setMaterial
                    };

                    document.getElementById('purchase-title-prefix').value = data['modal-title-prefix'];
                    document.getElementById('purchase-max-amount').value = data['modal-purchase-max'];
                    transactionSettings.purchase.add.material = data['modal-add-material'];
                    transactionSettings.purchase.remove.material = data['modal-remove-material'];
                    transactionSettings.purchase.set.material = data['modal-set-material'];

                    // Capture after state
                    const afterData = {
                        maxAmount: data['modal-purchase-max'],
                        titlePrefix: data['modal-title-prefix'],
                        addMaterial: data['modal-add-material'],
                        removeMaterial: data['modal-remove-material'],
                        setMaterial: data['modal-set-material']
                    };

                    // Log the update
                    addActivityEntry('updated', 'purchase-menu', beforeData, afterData);

                    updatePurchaseSettings();
                    updatePurchasePreview();
                }
            });
        }

        function openSellSettings() {
            const maxAmount = document.getElementById('sell-max-amount').value;
            const titlePrefix = document.getElementById('sell-title-prefix').value;
            const addMaterial = transactionSettings.sell.add.material;
            const removeMaterial = transactionSettings.sell.remove.material;
            const setMaterial = transactionSettings.sell.set.material;

            openEditModal({
                type: 'sell-settings',
                title: '⚙️ Sell Menu Settings',
                fields: [
                    { label: 'Title Prefix (use & for colors)', id: 'modal-title-prefix', type: 'text', value: titlePrefix },
                    { label: 'Max Amount', id: 'modal-sell-max', type: 'number', value: maxAmount, hint: 'Maximum items per sale' },
                    { label: 'ADD Buttons Material', id: 'modal-add-material', type: 'text', value: addMaterial, hint: 'Material for all ADD buttons' },
                    { label: 'REMOVE Buttons Material', id: 'modal-remove-material', type: 'text', value: removeMaterial, hint: 'Material for all REMOVE buttons' },
                    { label: 'SET Buttons Material', id: 'modal-set-material', type: 'text', value: setMaterial, hint: 'Material for all SET buttons' }
                ],
                onSave: (data) => {
                    // Capture before state
                    const beforeData = {
                        maxAmount: maxAmount,
                        titlePrefix: titlePrefix,
                        addMaterial: addMaterial,
                        removeMaterial: removeMaterial,
                        setMaterial: setMaterial
                    };

                    document.getElementById('sell-title-prefix').value = data['modal-title-prefix'];
                    document.getElementById('sell-max-amount').value = data['modal-sell-max'];
                    transactionSettings.sell.add.material = data['modal-add-material'];
                    transactionSettings.sell.remove.material = data['modal-remove-material'];
                    transactionSettings.sell.set.material = data['modal-set-material'];

                    // Capture after state
                    const afterData = {
                        maxAmount: data['modal-sell-max'],
                        titlePrefix: data['modal-title-prefix'],
                        addMaterial: data['modal-add-material'],
                        removeMaterial: data['modal-remove-material'],
                        setMaterial: data['modal-set-material']
                    };

                    // Log the update
                    addActivityEntry('updated', 'sell-menu', beforeData, afterData);

                    updateSellSettings();
                    updateSellPreview();
                }
            });
        }

        function openDisplayItemModal(type) {
            const typeLabel = type === 'purchase' ? 'Purchase' : 'Sell';
            const displayMaterial = document.getElementById(`${type}-display-material`).value;
            const displaySlot = document.getElementById(`${type}-display-slot`).value;
            const loreSpawner = document.getElementById(`${type}-lore-spawner`).value;

            let fields = [
                { label: 'Display Material', id: 'modal-display-material', type: 'text', value: displayMaterial, hint: 'For preview only' },
                { label: 'Display Slot (0-53)', id: 'modal-display-slot', type: 'number', value: displaySlot, min: 0, max: 53 }
            ];

            if (type === 'purchase') {
                const loreAmount = document.getElementById('purchase-lore-amount').value;
                const loreTotal = document.getElementById('purchase-lore-total').value;
                fields.push(
                    { label: 'Amount Lore (use & for colors)', id: 'modal-lore-amount', type: 'text', value: loreAmount, hint: 'e.g., &eAmount: &7' },
                    { label: 'Total Lore (use & for colors)', id: 'modal-lore-total', type: 'text', value: loreTotal, hint: 'e.g., &eTotal: &7' },
                    { label: 'Spawner Lore (use & for colors)', id: 'modal-lore-spawner', type: 'text', value: loreSpawner, hint: 'e.g., &7Spawner: &e' }
                );
            } else {
                const loreSelectedAmount = document.getElementById('sell-lore-selected-amount').value;
                const loreSellPrice = document.getElementById('sell-lore-sell-price').value;
                const loreYouOwn = document.getElementById('sell-lore-you-own').value;
                fields.push(
                    { label: 'Selected Amount Lore (use & for colors)', id: 'modal-lore-selected-amount', type: 'text', value: loreSelectedAmount, hint: 'e.g., &eSelected amount: &7' },
                    { label: 'Sell Price Lore (use & for colors)', id: 'modal-lore-sell-price', type: 'text', value: loreSellPrice, hint: 'e.g., &eSell price: &7' },
                    { label: 'You Own Lore (use & for colors)', id: 'modal-lore-you-own', type: 'text', value: loreYouOwn, hint: 'e.g., &eYou own: &7' },
                    { label: 'Spawner Lore (use & for colors)', id: 'modal-lore-spawner', type: 'text', value: loreSpawner, hint: 'e.g., &7Spawner: &e' }
                );
            }

            openEditModal({
                type: `${type}-display-item`,
                title: `⚙️ ${typeLabel} Display Item Lore`,
                fields: fields,
                onSave: (data) => {
                    document.getElementById(`${type}-display-material`).value = data['modal-display-material'];
                    document.getElementById(`${type}-display-slot`).value = data['modal-display-slot'];

                    if (type === 'purchase') {
                        document.getElementById('purchase-lore-amount').value = data['modal-lore-amount'];
                        document.getElementById('purchase-lore-total').value = data['modal-lore-total'];
                        document.getElementById('purchase-lore-spawner').value = data['modal-lore-spawner'];
                        updatePurchaseSettings();
                        updatePurchasePreview();
                    } else {
                        document.getElementById('sell-lore-selected-amount').value = data['modal-lore-selected-amount'];
                        document.getElementById('sell-lore-sell-price').value = data['modal-lore-sell-price'];
                        document.getElementById('sell-lore-you-own').value = data['modal-lore-you-own'];
                        document.getElementById('sell-lore-spawner').value = data['modal-lore-spawner'];
                        updateSellSettings();
                        updateSellPreview();
                    }
                }
            });
        }

        function addItem() {
            const item = {
                id: itemIdCounter++,
                material: 'DIAMOND',
                name: '&bExample Item',
                price: 100,
                sellPrice: 50,
                amount: 1,
                lore: [],
                spawnerType: '',
                potionType: '',
                potionLevel: 0,
                enchantments: {},
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false,
                unstableTnt: false
            };

            items.push(item);
            renderItems();
            updateAll();

            // Log creation
            addActivityEntry('created', 'shop-item', null, JSON.parse(JSON.stringify(item)), { shopFile: currentShopFile });
        }

        function removeItem(id) {
            const item = items.find(i => i.id === id);
            if (item) {
                // Log deletion before removing
                addActivityEntry('deleted', 'shop-item', JSON.parse(JSON.stringify(item)), null, { shopFile: currentShopFile });
            }

            items = items.filter(item => item.id !== id);
            renderItems();
            updateAll();
        }

        async function removeShopFile() {
            if (!currentShopFile) {
                showAlert('No shop file selected!', 'warning');
                return;
            }

            const confirmed = await showConfirm(`Are you sure you want to delete "${currentShopFile}"?\n\nThis action cannot be undone!`);
            if (!confirmed) return;

            try {
                // Delete the file from server
                const response = await fetch(`${API_URL}/api/file/shops/${currentShopFile}`, {
                    method: 'DELETE',
                    headers: {
                        'X-Session-Token': sessionToken
                    }
                });

                if (response.status === 401) {
                    showAlert('Session expired. Please login again.', 'warning');
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Log deletion
                const deletedFilename = currentShopFile;
                addActivityEntry('deleted', 'shop-file', { filename: deletedFilename }, null, { filename: deletedFilename });

                // Remove from local data
                delete allShops[currentShopFile];

                // Remove from dropdown
                const shopSelector = document.getElementById('shop-selector');
                const optionToRemove = Array.from(shopSelector.options).find(opt => opt.value === currentShopFile);
                if (optionToRemove) {
                    optionToRemove.remove();
                }

                // Switch to first available shop or clear
                const remainingShops = Object.keys(allShops);
                if (remainingShops.length > 0) {
                    currentShopFile = remainingShops[0];
                    shopSelector.value = currentShopFile;
                    loadShopFromData(currentShopFile);
                } else {
                    // No shops left, clear everything
                    currentShopFile = '';
                    items = [];
                    itemIdCounter = 0;
                    renderItems();
                    updateAll();
                }

                showAlert('Shop file deleted successfully!', 'success');
            } catch (error) {
                console.error('Failed to delete shop file:', error);
                showAlert('Failed to delete shop file: ' + error.message);
            }
        }

        function renderItems() {
            // Update item count display
            const itemsCountDisplay = document.getElementById('items-count-display');
            if (itemsCountDisplay) {
                itemsCountDisplay.textContent = items.length;
            }
        }

        function updateItem(id, field, value) {
            const item = items.find(i => i.id === id);
            if (item) {
                item[field] = value;
                updateAll();
            }
        }

        function generatePreviewGrid() {
            const grid = document.getElementById('preview-grid');
            grid.innerHTML = '';

            const rows = parseInt(document.getElementById('rows').value) || 3;
            const totalSlots = (rows + 1) * 9;

            for (let i = 0; i < totalSlots; i++) {
                const slot = document.createElement('div');
                slot.className = 'gui-slot';
                slot.dataset.slot = i;
                grid.appendChild(slot);
            }
        }

        function getItemTexture(material) {
            // Convert material name to lowercase and get texture
            const materialName = material.toLowerCase();
            return `${TEXTURE_API}${materialName}.png`;
        }

        function getMobHeadTexture(mobType) {
            // Map mob types to their MHF_ entity names for mc-heads.net
            const mobHeadMap = {
                'CREEPER': 'MHF_Creeper',
                'GHAST': 'MHF_Ghast',
                'SLIME': 'MHF_Slime',
                'PRESENT1': 'MHF_Present1',
                'PRESENT2': 'MHF_Present2',
                'PIGZOMBIE': 'MHF_PigZombie',
                'CHICKEN': 'MHF_Chicken',
                'MELON': 'MHF_Melon',
                'CACTUS': 'MHF_Cactus',
                'WITHER': 'MHF_WSkeleton',
                'WITHER_SKELETON': 'MHF_WSkeleton',
                'ENDERMAN': 'MHF_Enderman',
                'BLAZE': 'MHF_Blaze',
                'CAVESPIDER': 'MHF_CaveSpider',
                'CAVE_SPIDER': 'MHF_CaveSpider',
                'TNT2': 'MHF_TNT2',
                'APPLE': 'MHF_Apple',
                'CAKE': 'MHF_Cake',
                'QUESTION': 'MHF_Question',
                'EXCLAMATION': 'MHF_Exclamation',
                'ARROWDOWN': 'MHF_ArrowDown',
                'ARROWUP': 'MHF_ArrowUp',
                'ARROWLEFT': 'MHF_ArrowLeft',
                'ARROWRIGHT': 'MHF_ArrowRight',
                'SQUID': 'MHF_Squid',
                'COCONUTB': 'MHF_CoconutB',
                'COCONUTG': 'MHF_CoconutG',
                'SKELETON': 'MHF_Skeleton',
                'PIG': 'MHF_Pig',
                'SHEEP': 'MHF_Sheep',
                'FACEBOOK': 'MHF_Facebook',
                'CHICKEN2': 'MHF_Chicken',
                'MUSHROOM_COW': 'MHF_MushroomCow',
                'MUSHROOMCOW': 'MHF_MushroomCow',
                'MOOSHROOM': 'MHF_MushroomCow',
                'VILLAGER': 'MHF_Villager',
                'GOLEM': 'MHF_Golem',
                'IRON_GOLEM': 'MHF_Golem',
                'CAVESPIDER2': 'MHF_CaveSpider',
                'TNT': 'MHF_TNT',
                'SPIDER': 'MHF_Spider',
                'ZOMBIE': 'MHF_Zombie',
                'HEROBRINE': 'MHF_Herobrine',
                'LAVASLIME': 'MHF_LavaSlime',
                'MAGMA_CUBE': 'MHF_LavaSlime',
                'COW': 'MHF_Cow',
                'PUMPKIN': 'MHF_Pumpkin',
                'PIGMAN': 'MHF_PigZombie',
                'ZOMBIFIED_PIGLIN': 'MHF_PigZombie',
                'OCELOT': 'MHF_Ocelot',
                'CATLEFT': 'MHF_CatLeft',
                'CATRIGHT': 'MHF_CatRight',
                'STEVERIGHT': 'MHF_SteveRight',
                'STEVELEFT': 'MHF_SteveLeft',
                'PRESENT': 'MHF_Present1',
                'VEX': 'MHF_Vex',
                'SNOWGOLEM': 'MHF_SnowGolem',
                'SNOW_GOLEM': 'MHF_SnowGolem',
                'WITCH': 'MHF_Witch'
            };

            const mhfName = mobHeadMap[mobType.toUpperCase()] || 'MHF_Zombie';
            return `https://mc-heads.net/head/${mhfName}`;
        }

        function updatePreview() {
            const guiName = document.getElementById('gui-name') ? document.getElementById('gui-name').value : '&8Shop';
            const rows = document.getElementById('rows') ? parseInt(document.getElementById('rows').value) || 3 : 3;
            const itemsPerPage = rows * 9;

            // Update display fields in shop tab
            const guiNameDisplay = document.getElementById('gui-name-display');
            if (guiNameDisplay) {
                guiNameDisplay.innerHTML = parseMinecraftColors(guiName);
            }
            const rowsDisplay = document.getElementById('rows-display');
            if (rowsDisplay) {
                rowsDisplay.textContent = rows;
            }

            if (document.getElementById('preview-title')) {
                document.getElementById('preview-title').innerHTML = parseMinecraftColors(guiName);
            }
            generatePreviewGrid();

            // Calculate pagination
            const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

            // Show/hide page navigation
            const pageNav = document.getElementById('page-navigation');
            if (totalPages > 1) {
                pageNav.style.display = 'block';
                document.getElementById('page-indicator').textContent = `Page ${currentPreviewPage + 1}/${totalPages}`;
            } else {
                pageNav.style.display = 'none';
                currentPreviewPage = 0;
            }

            // Ensure current page is valid
            if (currentPreviewPage >= totalPages) {
                currentPreviewPage = totalPages - 1;
            }
            if (currentPreviewPage < 0) {
                currentPreviewPage = 0;
            }

            const grid = document.getElementById('preview-grid');
            const slots = grid.querySelectorAll('.gui-slot');

            // Calculate items for current page
            const startIndex = currentPreviewPage * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = items.slice(startIndex, endIndex);

            pageItems.forEach((item, pageIndex) => {
                const slot = slots[pageIndex];
                slot.classList.add('filled');

                // Add enchanted class if item has enchantments
                if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                    slot.classList.add('enchanted');
                }

                const textureUrl = getItemTexture(item.material);
                const itemName = parseMinecraftColors(item.name);

                // Check if it's a spawner with a type - show spawner type name badge
                let spawnerBadge = '';
                const upperMaterial = item.material ? item.material.toUpperCase() : '';
                if ((upperMaterial === 'SPAWNER' || upperMaterial === 'TRIAL_SPAWNER') && item.spawnerType) {
                    spawnerBadge = `<div class="spawner-badge">${item.spawnerType}</div>`;
                }

                slot.innerHTML = `
                    <div class="item-icon">
                        <img src="${textureUrl}"
                             alt="${item.material}"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                        ${item.amount > 1 ? `<span class="item-count">${item.amount}</span>` : ''}
                        ${spawnerBadge}
                    </div>
                `;

                // Add cursor pointer for clickable items
                slot.style.cursor = 'pointer';

                // Add Minecraft-style tooltip on hover
                slot.addEventListener('mouseenter', (e) => showMinecraftTooltip(e, item));
                slot.addEventListener('mousemove', (e) => moveMinecraftTooltip(e));
                slot.addEventListener('mouseleave', hideMinecraftTooltip);

                // Add click handler to open modal editor
                slot.addEventListener('click', () => openShopItemModal(item.id));
            });
        }

        function changePage(direction) {
            const rows = parseInt(document.getElementById('rows').value) || 3;
            const itemsPerPage = rows * 9;
            const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

            currentPreviewPage += direction;

            // Wrap around
            if (currentPreviewPage < 0) {
                currentPreviewPage = totalPages - 1;
            } else if (currentPreviewPage >= totalPages) {
                currentPreviewPage = 0;
            }

            updatePreview();
        }

        function showMinecraftTooltip(event, item) {
            const tooltip = document.getElementById('item-tooltip');
            const itemName = parseMinecraftColors(item.name);

            let tooltipHTML = `<div class="tooltip-title">${itemName}</div>`;

            // Show spawner type if it's a spawner
            if ((item.material === 'SPAWNER' || item.material === 'TRIAL_SPAWNER') && item.spawnerType) {
                const spawnerLabel = item.material === 'TRIAL_SPAWNER' ? 'Trial Spawner' : 'Spawner';
                tooltipHTML += `<div class="tooltip-line" style="color:#55ff55;">${spawnerLabel}: ${item.spawnerType}</div>`;
            }

            // Show potion type if it's a potion or tipped arrow
            if ((item.material === 'POTION' || item.material === 'SPLASH_POTION' || item.material === 'LINGERING_POTION' || item.material === 'TIPPED_ARROW') && item.potionType) {
                const potionLabel = item.material === 'TIPPED_ARROW' ? 'Arrow Effect' : 'Potion';
                tooltipHTML += `<div class="tooltip-line" style="color:#ff55ff;">${potionLabel}: ${item.potionType}</div>`;
            }

            // Show enchantments if available
            if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                Object.entries(item.enchantments).forEach(([enchName, level]) => {
                    const displayName = enchName.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                    tooltipHTML += `<div class="tooltip-line" style="color:#aaaaff;">${displayName} ${level}</div>`;
                });
            }

            // Show lore if available
            if (item.lore && item.lore.length > 0) {
                item.lore.forEach(line => {
                    // Show empty lines as blank spacing, non-empty lines with color parsing
                    if (line.trim()) {
                        tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(line)}</div>`;
                    } else {
                        tooltipHTML += `<div class="tooltip-line">&nbsp;</div>`;
                    }
                });
            }

            tooltipHTML += `<div class="tooltip-line">Amount: ${item.amount}</div>`;
            tooltipHTML += `<div class="tooltip-price">Buy: $${item.price}</div>`;
            if (item.sellPrice) {
                tooltipHTML += `<div class="tooltip-sell">Sell: $${item.sellPrice}</div>`;
            }
            tooltipHTML += `<div class="tooltip-line" style="color:#55ffff; margin-top:4px;">Click to edit</div>`;

            tooltip.innerHTML = tooltipHTML;
            tooltip.classList.add('show');
            moveMinecraftTooltip(event);
        }

        function moveMinecraftTooltip(event) {
            const tooltip = document.getElementById('item-tooltip');
            tooltip.style.left = (event.clientX + 15) + 'px';
            tooltip.style.top = (event.clientY + 15) + 'px';
        }

        function hideMinecraftTooltip() {
            const tooltip = document.getElementById('item-tooltip');
            tooltip.classList.remove('show');
        }

        function scrollToItem(itemId) {
            const card = document.getElementById(`item-card-${itemId}`);
            if (card) {
                // Switch to shop tab
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.querySelector('.tab').classList.add('active');
                document.getElementById('shop-tab').classList.add('active');

                // Scroll to item
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Highlight effect
                card.classList.add('highlight');
                setTimeout(() => card.classList.remove('highlight'), 1000);
            }
        }

        function updateExport() {
            const shopKey = getShopKey();
            const guiName = document.getElementById('gui-name').value;
            const rows = parseInt(document.getElementById('rows').value) || 3;
            const permission = document.getElementById('permission').value;
            const availableTimes = document.getElementById('available-times').value;

            let shopYaml = `gui-name: '${guiName}'\n`;
            shopYaml += `rows: ${rows}\n`;
            shopYaml += `permission: '${permission}'\n`;
            if (availableTimes && availableTimes.trim()) {
                const timeLines = availableTimes.split('\n').filter(l => l.trim());
                if (timeLines.length > 0) {
                    shopYaml += `available-times:\n`;
                    timeLines.forEach(timeLine => {
                        shopYaml += `  - "${timeLine.trim()}"\n`;
                    });
                }
            }
            shopYaml += `item-lore:\n`;
            shopYaml += `  shop-show-buy-price: ${document.getElementById('shop-show-buy-price').checked}\n`;
            shopYaml += `  shop-buy-price-line: '${document.getElementById('shop-buy-price-line').value}'\n`;
            shopYaml += `  shop-show-buy-hint: ${document.getElementById('shop-show-buy-hint').checked}\n`;
            shopYaml += `  shop-buy-hint-line: '${document.getElementById('shop-buy-hint-line').value}'\n`;
            shopYaml += `  shop-show-sell-price: ${document.getElementById('shop-show-sell-price').checked}\n`;
            shopYaml += `  shop-sell-price-line: '${document.getElementById('shop-sell-price-line').value}'\n`;
            shopYaml += `  shop-show-sell-hint: ${document.getElementById('shop-show-sell-hint').checked}\n`;
            shopYaml += `  shop-sell-hint-line: '${document.getElementById('shop-sell-hint-line').value}'\n`;
            shopYaml += `items:\n`;

            items.forEach(item => {
                shopYaml += `  - material: ${item.material}\n`;
                shopYaml += `    name: '${item.name}'\n`;
                shopYaml += `    price: ${item.price}\n`;
                if (item.sellPrice) {
                    shopYaml += `    sell-price: ${item.sellPrice}\n`;
                }
                shopYaml += `    amount: ${item.amount}\n`;
                if (item.spawnerType && item.spawnerType.trim()) {
                    shopYaml += `    spawner-type: ${item.spawnerType}\n`;
                }
                if (item.potionType && item.potionType.trim()) {
                    shopYaml += `    potion-type: ${item.potionType}\n`;
                }
                if (item.potionLevel && item.potionLevel > 0) {
                    shopYaml += `    potion-level: ${item.potionLevel}\n`;
                }
                if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                    shopYaml += `    enchantments:\n`;
                    Object.entries(item.enchantments).forEach(([enchName, level]) => {
                        shopYaml += `      ${enchName}: ${level}\n`;
                    });
                }
                if (item.hideAttributes) {
                    shopYaml += `    hide-attributes: true\n`;
                }
                if (item.hideAdditional) {
                    shopYaml += `    hide-additional: true\n`;
                }
                if (item.requireName) {
                    shopYaml += `    require-name: true\n`;
                }
                if (item.requireLore) {
                    shopYaml += `    require-lore: true\n`;
                }
                if (item.unstableTnt) {
                    shopYaml += `    unstable-tnt: true\n`;
                }
                if (item.lore && item.lore.length > 0) {
                    shopYaml += `    lore:\n`;
                    item.lore.forEach(line => {
                        shopYaml += `      - '${line}'\n`;
                    });
                }
            });

            // Update both elements for compatibility
            const shopYamlEl = document.getElementById('shop-yaml');
            const exportOutputEl = document.getElementById('export-output');

            if (shopYamlEl) shopYamlEl.textContent = shopYaml;
            if (exportOutputEl) exportOutputEl.textContent = shopYaml;
        }

        function updateGuiPreview() {
            // Update preview title with main menu title
            document.getElementById('preview-title').innerHTML = parseMinecraftColors(mainMenuTitle);

            // Update display elements in the sidebar
            const titleDisplay = document.getElementById('mainmenu-title-display');
            const rowsDisplay = document.getElementById('mainmenu-rows-display');
            const buttonsCount = document.getElementById('mainmenu-buttons-count');

            if (titleDisplay) titleDisplay.innerHTML = parseMinecraftColors(mainMenuTitle) || 'Not Set';
            if (rowsDisplay) rowsDisplay.textContent = mainMenuRows || '3';
            if (buttonsCount) buttonsCount.textContent = loadedGuiShops.length || '0';

            // Hide page navigation (main menu doesn't have pages)
            document.getElementById('page-navigation').style.display = 'none';

            const grid = document.getElementById('preview-grid');
            grid.innerHTML = '';

            // Create slots based on mainMenuRows (each row = 9 slots)
            const totalSlots = mainMenuRows * 9;
            for (let i = 0; i < totalSlots; i++) {
                const slot = document.createElement('div');
                slot.className = 'gui-slot';

                // Check if this slot has a shop from loaded gui.yml
                let shopData = loadedGuiShops.find(shop => shop.slot === i);

                if (shopData) {
                    slot.classList.add('filled');
                    const textureUrl = getItemTexture(shopData.material);
                    const displayName = parseMinecraftColors(shopData.name);

                    slot.innerHTML = `
                        <div class="item-icon">
                            <img src="${textureUrl}"
                                 alt="${shopData.material}"
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                        </div>
                    `;

                    // Add click to open modal editor
                    slot.style.cursor = 'pointer';
                    slot.addEventListener('click', () => {
                        const shopIndex = loadedGuiShops.findIndex(shop => shop.slot === i);
                        if (shopIndex !== -1) {
                            openMainMenuShopModal(shopIndex);
                        }
                    });

                    // Add tooltip for GUI button
                    slot.addEventListener('mouseenter', (e) => {
                        const tooltip = document.getElementById('item-tooltip');

                        let tooltipHTML = `<div class="tooltip-title">${displayName}</div>`;

                        // Show lore (display empty lines as spacing)
                        if (shopData.lore && shopData.lore.length > 0) {
                            shopData.lore.forEach(line => {
                                // Show empty lines as blank spacing, non-empty lines with color parsing
                                if (line.trim()) {
                                    tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(line)}</div>`;
                                } else {
                                    tooltipHTML += `<div class="tooltip-line">&nbsp;</div>`;
                                }
                            });
                        }

                        tooltipHTML += `<div class="tooltip-line" style="color:#aaa; margin-top:4px; font-size:11px;">Slot: ${i}</div>`;
                        if (shopData.key) {
                            tooltipHTML += `<div class="tooltip-line" style="color:#55ff55;">Shop: ${shopData.key}</div>`;
                        }
                        tooltipHTML += `<div class="tooltip-line" style="color:#55ffff; margin-top:4px;">Click to edit</div>`;

                        tooltip.innerHTML = tooltipHTML;
                        tooltip.classList.add('show');
                        moveMinecraftTooltip(e);
                    });
                    slot.addEventListener('mousemove', moveMinecraftTooltip);
                    slot.addEventListener('mouseleave', hideMinecraftTooltip);
                }

                grid.appendChild(slot);
            }
        }

        function updateAll() {
            updatePreview();
            updateExport();
            scheduleAutoSave();
        }

        // Auto-load all files from server
        async function loadAllFiles() {
            try {
                console.log('[LOAD] Starting to load files from:', API_URL);
                console.log('[LOAD] Session token:', sessionToken ? 'present' : 'missing');
                updateSaveStatus('Loading files...', '#ffaa00');

                const response = await fetch(`${API_URL}/api/files?t=${Date.now()}`, {
                    headers: {
                        'X-Session-Token': sessionToken,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });

                console.log('[LOAD] Response status:', response.status);

                if (response.status === 401) {
                    console.error('[LOAD] Session expired');
                    showAlert('Session expired. Please login again.', 'warning');
                    logout();
                    return;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[LOAD] Error response:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
                }

                const data = await response.json();

                // Load shop files and populate dropdown
                if (data.shops) {
                    allShops = data.shops;
                    console.log('Loaded shops:', Object.keys(allShops));

                    // Populate shop selector dropdown
                    const shopSelector = document.getElementById('shop-selector');
                    shopSelector.innerHTML = '';

                    const shopFiles = Object.keys(allShops).sort();
                    console.log('Shop files found:', shopFiles);

                    shopFiles.forEach(filename => {
                        const option = document.createElement('option');
                        option.value = filename;
                        option.textContent = filename;
                        shopSelector.appendChild(option);
                    });

                    // Load first shop or current shop
                    if (shopFiles.length > 0) {
                        if (allShops[currentShopFile]) {
                            shopSelector.value = currentShopFile;
                        } else {
                            currentShopFile = shopFiles[0];
                            shopSelector.value = currentShopFile;
                        }
                        console.log('Loading shop:', currentShopFile);
                        loadShopFromData(currentShopFile);
                    } else {
                        console.warn('No shop files found');
                    }
                }

                // Load menu files
                if (data.mainMenu) {
                    console.log('Loading main-menu.yml, length:', data.mainMenu.length);
                    parseMainMenuYaml(data.mainMenu);
                    renderMainMenuShops();
                } else {
                    console.warn('No main-menu.yml data received');
                }

                if (data.purchaseMenu) {
                    console.log('Loading purchase-menu.yml, length:', data.purchaseMenu.length);
                    parsePurchaseMenuYaml(data.purchaseMenu);
                    renderPurchaseButtons();
                } else {
                    console.warn('No purchase-menu.yml data received');
                }

                if (data.sellMenu) {
                    console.log('Loading sell-menu.yml, length:', data.sellMenu.length);
                    parseSellMenuYaml(data.sellMenu);
                    renderSellButtons();
                } else {
                    console.warn('No sell-menu.yml data received');
                }

                // Update preview based on current active tab
                if (currentTab === 'mainmenu') {
                    updateGuiPreview();
                } else if (currentTab === 'purchase') {
                    updatePurchasePreview();
                } else if (currentTab === 'sell') {
                    updateSellPreview();
                }

                updateSaveStatus('✓ Loaded', '#55ff55');
                setTimeout(() => updateSaveStatus(''), 2000);

                console.log('All files loaded successfully');
                isLoadingFiles = false; // Allow saving after load completes

                // Clear unsaved changes after loading from server
                unsavedChanges = [];
            } catch (error) {
                console.error('Failed to load files:', error);
                updateSaveStatus('✗ Load failed', '#ff5555');
                showAlert('Failed to connect to server. Make sure the API is enabled and running on ' + API_URL);
                isLoadingFiles = false;
            }
        }

        // Load a specific shop file into the editor
        function loadShopFromData(filename) {
            if (!allShops[filename]) {
                console.warn('Shop file not found:', filename);
                return;
            }

            currentShopFile = filename;
            const yamlContent = allShops[filename];

            // Parse the shop YAML and populate items
            parseShopYaml(yamlContent);
            renderItems();
            updateAll();
        }

        // Parse shop YAML into items array
        function parseShopYaml(yamlContent) {
            items = [];
            itemIdCounter = 0;

            // Decode HTML entities if present (e.g., &amp; -> &)
            yamlContent = yamlContent.replace(/&amp;/g, '&');

            const lines = yamlContent.split('\n');
            let currentItem = null;
            let inLore = false;
            let inItemsSection = false;
            let inAvailableTimes = false;
            let inShopItemLore = false;
            let availableTimesList = [];

            console.log('Parsing shop YAML, total lines:', lines.length);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                if (!trimmed || trimmed.startsWith('#')) continue;

                const indent = line.search(/\S/);

                // Parse shop-level item-lore settings (indent 2)
                if (!inItemsSection && inShopItemLore && indent === 2) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'shop-show-buy-price') {
                        document.getElementById('shop-show-buy-price').checked = value === 'true';
                    } else if (key.trim() === 'shop-buy-price-line') {
                        document.getElementById('shop-buy-price-line').value = value;
                    } else if (key.trim() === 'shop-show-buy-hint') {
                        document.getElementById('shop-show-buy-hint').checked = value === 'true';
                    } else if (key.trim() === 'shop-buy-hint-line') {
                        document.getElementById('shop-buy-hint-line').value = value;
                    } else if (key.trim() === 'shop-show-sell-price') {
                        document.getElementById('shop-show-sell-price').checked = value === 'true';
                    } else if (key.trim() === 'shop-sell-price-line') {
                        document.getElementById('shop-sell-price-line').value = value;
                    } else if (key.trim() === 'shop-show-sell-hint') {
                        document.getElementById('shop-show-sell-hint').checked = value === 'true';
                    } else if (key.trim() === 'shop-sell-hint-line') {
                        document.getElementById('shop-sell-hint-line').value = value;
                    }
                }

                // Parse shop-level properties (before items section)
                if (!inItemsSection && indent === 0 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'gui-name') {
                        document.getElementById('gui-name').value = value;
                        inAvailableTimes = false;
                        inShopItemLore = false;
                    } else if (key.trim() === 'rows') {
                        document.getElementById('rows').value = parseInt(value) || 3;
                        inAvailableTimes = false;
                        inShopItemLore = false;
                    } else if (key.trim() === 'permission') {
                        document.getElementById('permission').value = value;
                        inAvailableTimes = false;
                        inShopItemLore = false;
                    } else if (key.trim() === 'available-times') {
                        inAvailableTimes = true;
                        inShopItemLore = false;
                        availableTimesList = [];
                    } else if (key.trim() === 'item-lore') {
                        inShopItemLore = true;
                        inAvailableTimes = false;
                    }
                }

                // Parse available-times list items (indent 2)
                if (inAvailableTimes && indent === 2 && trimmed.startsWith('-')) {
                    const timeValue = trimmed.substring(1).trim().replace(/['"]/g, '');
                    availableTimesList.push(timeValue);
                }

                // Check if we're in the items section
                if (indent === 0 && trimmed === 'items:') {
                    inItemsSection = true;
                    inAvailableTimes = false;
                    inShopItemLore = false;
                    // Set available-times field
                    document.getElementById('available-times').value = availableTimesList.join('\n');
                    console.log('Found items section at line', i);
                    continue;
                }

                // Skip non-items section content
                if (!inItemsSection) continue;

                // Debug: show what we're looking at in items section
                if (trimmed.startsWith('-')) {
                    console.log('Line', i, 'indent', indent, 'starts with dash:', trimmed.substring(0, 30));
                }

                // New item - two formats supported:
                // Format 1: "- material: STONE" (material on same line as dash)
                // Format 2: "-" followed by "material: STONE" on next line
                // Supports indent 0, 2, or 4 (flexible indentation)
                if (inItemsSection && trimmed.startsWith('- material:')) {
                    if (currentItem) {
                        items.push(currentItem);
                    }
                    const material = trimmed.substring(12).trim().replace(/['"]/g, '');
                    currentItem = {
                        id: itemIdCounter++,
                        material: material,
                        name: '&eItem',
                        price: 0,
                        sellPrice: 0,
                        amount: 1,
                        lore: [],
                        spawnerType: '',
                        potionType: '',
                        potionLevel: 0,
                        enchantments: {},
                        hideAttributes: false,
                        hideAdditional: false,
                        requireName: false,
                        requireLore: false,
                        unstableTnt: false
                    };
                    inLore = false;
                    console.log('Parsed item (format 1):', material, 'at line', i, 'indent', indent);
                }
                // Handle format where dash is alone: just "-"
                else if (inItemsSection && trimmed === '-') {
                    // Next line should have material
                    if (currentItem) {
                        items.push(currentItem);
                    }
                    currentItem = {
                        id: itemIdCounter++,
                        material: 'STONE',
                        name: '&eItem',
                        price: 0,
                        sellPrice: 0,
                        amount: 1,
                        lore: [],
                        spawnerType: '',
                        potionType: '',
                        potionLevel: 0,
                        enchantments: {},
                        hideAttributes: false,
                        hideAdditional: false,
                        requireName: false,
                        requireLore: false,
                        unstableTnt: false
                    };
                    inLore = false;
                    console.log('Started new item (format 2) at line', i, 'indent', indent);
                }
                // Lore items - check this BEFORE regular properties
                else if (currentItem && inLore && trimmed.startsWith('-')) {
                    const loreText = trimmed.substring(1).trim().replace(/['"]/g, '');
                    currentItem.lore.push(loreText);
                }
                // Item properties
                else if (currentItem && indent >= 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    // Exit lore section when we hit another property
                    if (inLore) {
                        inLore = false;
                    }

                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'material') {
                        currentItem.material = value;
                        console.log('Set material:', value, 'at line', i);
                    } else if (key.trim() === 'name') {
                        currentItem.name = value;
                    } else if (key.trim() === 'price') {
                        currentItem.price = parseFloat(value);
                    } else if (key.trim() === 'sell-price') {
                        currentItem.sellPrice = parseFloat(value);
                    } else if (key.trim() === 'amount') {
                        currentItem.amount = parseInt(value);
                    } else if (key.trim() === 'spawner-type') {
                        currentItem.spawnerType = value;
                    } else if (key.trim() === 'potion-type') {
                        currentItem.potionType = value;
                    } else if (key.trim() === 'potion-level') {
                        currentItem.potionLevel = parseInt(value) || 0;
                    } else if (key.trim() === 'hide-attributes') {
                        currentItem.hideAttributes = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'hide-additional') {
                        currentItem.hideAdditional = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'require-name') {
                        currentItem.requireName = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'require-lore') {
                        currentItem.requireLore = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'unstable-tnt') {
                        currentItem.unstableTnt = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'lore') {
                        inLore = true;
                    } else if (key.trim() === 'enchantments') {
                        // Start enchantments section
                    }
                }
                // Enchantment entries (indent 6+)
                else if (currentItem && indent >= 6 && trimmed.includes(':') && !inLore) {
                    const [enchName, ...levelParts] = trimmed.split(':');
                    const level = parseInt(levelParts.join(':').trim());
                    if (!isNaN(level)) {
                        currentItem.enchantments[enchName.trim().toUpperCase()] = level;
                    }
                }
            }

            if (currentItem) {
                items.push(currentItem);
            }

            console.log('Parsed', items.length, 'items from shop file');
        }

        // Schedule auto-save (debounced)
        function scheduleAutoSave() {
            // Check if auto-save is enabled
            const autoSaveToggle = document.getElementById('auto-save-toggle');
            if (!autoSaveToggle || !autoSaveToggle.checked) {
                return; // Auto-save disabled
            }

            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
            }
            autoSaveTimeout = setTimeout(() => {
                saveCurrentShop();
            }, 2000); // Save 2 seconds after last change
        }

        // Sync current configuration from server (clears cache)
        async function reloadCurrentConfig() {
            const confirmed = await showConfirm('Sync with server? Any unsaved changes will be lost.');
            if (!confirmed) {
                return;
            }

            try {
                updateSaveStatus('Syncing...', '#ffaa00');

                const response = await fetch(`${API_URL}/api/files?t=${Date.now()}`, {
                    headers: {
                        'X-Session-Token': sessionToken,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });

                if (response.status === 401) {
                    showAlert('Session expired. Please login again.', 'warning');
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Reload shops
                if (data.shops) {
                    allShops = data.shops;
                }

                // Reload menu files
                if (data.mainMenu) {
                    parseMainMenuYaml(data.mainMenu);
                }
                if (data.purchaseMenu) {
                    parsePurchaseMenuYaml(data.purchaseMenu);
                }
                if (data.sellMenu) {
                    parseSellMenuYaml(data.sellMenu);
                }

                // Reload current shop
                if (currentShopFile && allShops[currentShopFile]) {
                    parseShopYaml(allShops[currentShopFile]);
                    renderItems();
                }

                // Restore the active tab and update preview
                if (currentTab === 'mainmenu') {
                    renderMainMenuShops();
                    updateGuiPreview();
                } else if (currentTab === 'shop') {
                    renderItems();
                    updatePreview();
                } else if (currentTab === 'purchase') {
                    renderPurchaseButtons();
                    updatePurchasePreview();
                } else if (currentTab === 'sell') {
                    renderSellButtons();
                    updateSellPreview();
                }

                updateSaveStatus('✓ Synced', '#55ff55');
                setTimeout(() => updateSaveStatus(''), 2000);

                // Clear unsaved changes after sync
                unsavedChanges = [];
            } catch (error) {
                console.error('Failed to sync:', error);
                updateSaveStatus('✗ Sync failed', '#ff5555');
                showAlert('Failed to sync: ' + error.message);
            }
        }

        // Save current shop to server
        async function saveCurrentShop() {
            if (isSaving) return;

            const yamlContent = document.getElementById('export-output').textContent;

            // Check if content has actually changed
            if (allShops[currentShopFile] === yamlContent) {
                console.log('No changes detected, skipping save');
                return;
            }

            isSaving = true;
            updateSaveStatus('Saving...', '#ffaa00');

            try {
                const response = await fetch(`${API_URL}/api/file/shops/${currentShopFile}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify({ content: yamlContent })
                });

                if (response.status === 401) {
                    showAlert('Session expired. Please login again.', 'warning');
                    logout();
                    return;
                }

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success) {
                    console.log('Shop saved successfully');
                    // Update local cache
                    allShops[currentShopFile] = yamlContent;
                    // Clear unsaved changes after successful save
                    unsavedChanges = [];
                    updateSaveStatus('✓ Auto-saved', '#55ff55');
                    setTimeout(() => updateSaveStatus(''), 2000);
                }
            } catch (error) {
                console.error('Failed to save shop:', error);
                updateSaveStatus('✗ Save failed', '#ff5555');
                showAlert('Failed to save: ' + error.message);
            } finally {
                isSaving = false;
            }
        }

        function getShopKey() {
            // Shop key is now the current shop filename without .yml
            return currentShopFile.replace('.yml', '');
        }

        function parseMinecraftColors(text) {
            if (!text) return '';

            const colors = {
                '&0': '#000000', '&1': '#0000AA', '&2': '#00AA00', '&3': '#00AAAA',
                '&4': '#AA0000', '&5': '#AA00AA', '&6': '#FFAA00', '&7': '#AAAAAA',
                '&8': '#555555', '&9': '#5555FF', '&a': '#55FF55', '&b': '#55FFFF',
                '&c': '#FF5555', '&d': '#FF55FF', '&e': '#FFFF55', '&f': '#FFFFFF',
                '&l': 'bold', '&o': 'italic', '&n': 'underline', '&m': 'strikethrough', '&k': 'obfuscated', '&r': 'reset'
            };

            let result = '';
            let currentColor = '#404040';
            let bold = false;
            let italic = false;
            let underline = false;
            let strikethrough = false;

            const parts = text.split(/(&[0-9a-fk-or])/g);

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (part.match(/^&[0-9a-f]$/)) {
                    currentColor = colors[part] || currentColor;
                } else if (part === '&l') {
                    bold = true;
                } else if (part === '&o') {
                    italic = true;
                } else if (part === '&n') {
                    underline = true;
                } else if (part === '&m') {
                    strikethrough = true;
                } else if (part === '&r') {
                    currentColor = '#404040';
                    bold = false;
                    italic = false;
                    underline = false;
                    strikethrough = false;
                } else if (part && !part.match(/^&[k]/)) {
                    let styles = `color: ${currentColor};`;
                    if (bold) styles += ' font-weight: bold;';
                    if (italic) styles += ' font-style: italic;';
                    if (underline) styles += ' text-decoration: underline;';
                    if (strikethrough) styles += ' text-decoration: line-through;';

                    result += `<span style="${styles}">${part}</span>`;
                }
            }

            return result || text;
        }

        function copyToClipboard(elementId) {
            const text = document.getElementById(elementId).textContent;
            navigator.clipboard.writeText(text).then(() => {
                showAlert('✓ Copied to clipboard!', 'success');
            });
        }

        function downloadFile(elementId, filename) {
            const text = document.getElementById(elementId).textContent;
            const blob = new Blob([text], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        // Load and parse gui.yml file
        function loadGuiFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                parseGuiYaml(content);
            };
            reader.readAsText(file);
        }

        // ========== MAIN MENU MANAGEMENT ==========

        function scrollToMainMenuShop(index) {
            const card = document.getElementById(`mainmenu-shop-${index}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight the card briefly
                card.style.transition = 'box-shadow 0.3s ease';
                card.style.boxShadow = '0 0 20px rgba(255, 212, 96, 0.8)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 1500);
            }
        }

        function renderMainMenuShops() {
            const container = document.getElementById('mainmenu-shops-list');
            container.innerHTML = '';

            if (loadedGuiShops.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No shops in main menu. Click "ADD NEW SHOP" to create one.</p>';
                return;
            }

            loadedGuiShops.sort((a, b) => a.slot - b.slot).forEach((shop, index) => {
                const card = document.createElement('div');
                card.className = 'item-card';
                card.style.position = 'relative';
                card.id = `mainmenu-shop-${index}`; // Add ID for scrolling

                const textureUrl = getItemTexture(shop.material);

                card.innerHTML = `
                    <button class="remove-btn" onclick="removeMainMenuShop(${index})">✕</button>
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <img src="${textureUrl}"
                             style="width: 32px; height: 32px; image-rendering: pixelated; margin-right: 10px;"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                        <h4 style="flex: 1; margin: 0;">${shop.name || shop.key}</h4>
                    </div>

                    <div class="form-group">
                        <label>Button Key (YAML identifier, no spaces)</label>
                        <input type="text" value="${shop.key}" placeholder="e.g., blocks, info_button"
                               onchange="updateMainMenuShop(${index}, 'key', this.value.replace(/[^a-zA-Z0-9_-]/g, '_'))">
                        <small style="color: #888;">Used as the identifier in the YAML file</small>
                    </div>

                    <div class="form-group">
                        <label>Slot (0-53)</label>
                        <input type="number" min="0" max="53" value="${shop.slot}"
                               onchange="updateMainMenuShop(${index}, 'slot', parseInt(this.value))">
                    </div>

                    <div class="form-group">
                        <label>Shop Key (File)</label>
                        <select onchange="updateMainMenuShop(${index}, 'shopKey', this.value)">
                            <option value="" ${shop.shopKey === '' ? 'selected' : ''}>-- No Action --</option>
                            ${Object.keys(allShops).map(filename => {
                                const shopKey = filename.replace('.yml', '');
                                return `<option value="${shopKey}" ${shop.shopKey === shopKey ? 'selected' : ''}>${shopKey}</option>`;
                            }).join('')}
                        </select>
                        <small style="color: #888;">Which shop file to open (leave as "No Action" for info buttons)</small>
                    </div>

                    <div class="form-group">
                        <label>Icon Material</label>
                        <input type="text" value="${shop.material}"
                               onchange="updateMainMenuShop(${index}, 'material', this.value)">
                    </div>

                    <div class="form-group">
                        <label>Display Name (use & for colors)</label>
                        <input type="text" value="${shop.name}"
                               onchange="updateMainMenuShop(${index}, 'name', this.value)">
                        <small style="color: #888;">This is what players see in-game</small>
                    </div>

                    <div class="form-group">
                        <label>Lore (one per line, use %available-times% for shop availability)</label>
                        <textarea onchange="updateMainMenuShop(${index}, 'lore', this.value.split('\\n'))">${(shop.lore || []).join('\n')}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Permission (leave empty for no permission)</label>
                        <input type="text" value="${shop.permission || ''}" placeholder="e.g., shop.premium"
                               onchange="updateMainMenuShop(${index}, 'permission', this.value)">
                    </div>

                    <div class="form-group" style="display: flex; gap: 20px; align-items: center;">
                        <label style="margin-bottom: 0;">
                            <input type="checkbox" ${shop.hideAttributes ? 'checked' : ''}
                                   onchange="updateMainMenuShop(${index}, 'hideAttributes', this.checked)"
                                   style="width: auto; margin-right: 8px;">
                            Hide Attributes
                        </label>
                        <label style="margin-bottom: 0;">
                            <input type="checkbox" ${shop.hideAdditional ? 'checked' : ''}
                                   onchange="updateMainMenuShop(${index}, 'hideAdditional', this.checked)"
                                   style="width: auto; margin-right: 8px;">
                            Hide Additional Tooltip
                        </label>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        function addMainMenuShop() {
            const availableShops = Object.keys(allShops).map(f => f.replace('.yml', ''));
            const defaultShop = availableShops[0] || 'example_shop';

            // Find first available slot
            const usedSlots = loadedGuiShops.map(s => s.slot);
            let newSlot = 0;
            while (usedSlots.includes(newSlot) && newSlot < 54) {
                newSlot++;
            }

            const newShop = {
                key: 'new_shop_' + Date.now(),
                slot: newSlot,
                material: 'CHEST',
                name: '&eNew Shop',
                lore: ['&7Click to open'],
                shopKey: defaultShop,
                permission: '',
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false
            };

            loadedGuiShops.push(newShop);
            renderMainMenuShops();
            updateGuiPreview();
            saveMainMenuYaml();

            // Log creation
            addActivityEntry('created', 'main-menu-button', null, JSON.parse(JSON.stringify(newShop)));
        }

        function updateMainMenuShop(index, field, value) {
            if (loadedGuiShops[index]) {
                loadedGuiShops[index][field] = value;

                // Don't update key when shopKey changes - keep them independent
                // The key is used as the YAML identifier and should remain stable

                renderMainMenuShops();
                updateGuiPreview();
                saveMainMenuYaml();
            }
        }

        async function removeMainMenuShop(index) {
            const confirmed = await showConfirm('Remove this shop from the main menu?');
            if (confirmed) {
                const shop = loadedGuiShops[index];
                if (shop) {
                    // Log deletion before removing
                    addActivityEntry('deleted', 'main-menu-button', JSON.parse(JSON.stringify(shop)), null);
                }

                loadedGuiShops.splice(index, 1);
                renderMainMenuShops();
                updateGuiPreview();
                saveMainMenuYaml();
            }
        }

        function updateMainMenuTitlePreview() {
            mainMenuTitle = document.getElementById('mainmenu-title').value;
            updateGuiPreview(); // Update the preview immediately (no save)
        }

        function updateMainMenuRowsPreview() {
            mainMenuRows = parseInt(document.getElementById('mainmenu-rows').value) || 3;
            updateGuiPreview(); // Update the preview immediately (no save)
        }

        function updateMainMenuConfig() {
            mainMenuTitle = document.getElementById('mainmenu-title').value;
            mainMenuRows = parseInt(document.getElementById('mainmenu-rows').value) || 3;
            updateGuiPreview(); // Update the preview immediately
            if (!isLoadingFiles) {
                saveMainMenuYaml();
            }
        }

        // Debounced save function to prevent excessive saves
        let saveGuiYamlTimeout = null;
        // Save main-menu.yml
        async function saveMainMenuYaml() {
            if (isLoadingFiles) {
                console.log('Skipping save - files are still loading');
                return;
            }

            try {
                let yamlContent = `# Main shop menu configuration\n`;
                yamlContent += `# This file contains the main menu that players see when opening /shop\n\n`;
                yamlContent += `title: '${mainMenuTitle}'\n`;
                yamlContent += `rows: ${mainMenuRows}\n\n`;
                yamlContent += `# Shop buttons\n`;
                yamlContent += `items:\n`;

                loadedGuiShops.forEach(shop => {
                    yamlContent += `  ${shop.key}:\n`;
                    yamlContent += `    slot: ${shop.slot}\n`;
                    yamlContent += `    material: ${shop.material}\n`;
                    yamlContent += `    name: '${shop.name}'\n`;
                    if (shop.lore && shop.lore.length > 0) {
                        yamlContent += `    lore:\n`;
                        shop.lore.forEach(line => {
                            yamlContent += `      - '${line}'\n`;
                        });
                    }
                    if (shop.shopKey) {
                        yamlContent += `    shop-key: ${shop.shopKey}\n`;
                    }
                    if (shop.permission) {
                        yamlContent += `    permission: ${shop.permission}\n`;
                    }
                    if (shop.hideAttributes) {
                        yamlContent += `    hide-attributes: true\n`;
                    }
                    if (shop.hideAdditional) {
                        yamlContent += `    hide-additional: true\n`;
                    }
                });

                const response = await fetch(`${API_URL}/api/file/menus/main-menu.yml`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify({ content: yamlContent })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log('Saved main-menu.yml');
            } catch (error) {
                console.error('Failed to save main-menu.yml:', error);
                showAlert('Failed to save main-menu.yml: ' + error.message);
            }
        }

        // Save purchase-menu.yml
        async function savePurchaseMenuYaml() {
            if (isLoadingFiles) {
                console.log('Skipping save - files are still loading');
                return;
            }

            try {
                let yamlContent = `# Purchase menu configuration\n`;
                yamlContent += `# This file contains settings for the item purchase interface\n\n`;
                yamlContent += `title-prefix: '${transactionSettings.purchase.titlePrefix}'\n`;
                yamlContent += `display-material: ${transactionSettings.purchase.displayMaterial}\n`;
                yamlContent += `display-slot: ${transactionSettings.purchase.displaySlot}\n`;
                yamlContent += `max-amount: ${transactionSettings.purchase.maxAmount}\n\n`;

                // Lore settings
                yamlContent += `# Display item lore placeholders\n`;
                yamlContent += `lore:\n`;
                yamlContent += `  amount: '${document.getElementById('purchase-lore-amount').value}'\n`;
                yamlContent += `  total: '${document.getElementById('purchase-lore-total').value}'\n`;
                yamlContent += `  spawner: '${document.getElementById('purchase-lore-spawner').value}'\n\n`;

                // Buttons
                yamlContent += `# Action buttons\n`;
                yamlContent += `buttons:\n`;

                // Static buttons
                ['confirm', 'cancel', 'back'].forEach(key => {
                    const btn = transactionSettings.purchase.buttons[key];
                    if (btn) {
                        yamlContent += `  ${key}:\n`;
                        yamlContent += `    material: ${btn.material}\n`;
                        yamlContent += `    name: '${btn.name}'\n`;
                        if (btn.lore && btn.lore.length > 0) {
                            yamlContent += `    lore:\n`;
                            btn.lore.forEach(line => yamlContent += `      - '${line}'\n`);
                        }
                        yamlContent += `    slot: ${btn.slot}\n\n`;
                    }
                });

                // Add buttons
                if (transactionSettings.purchase.add && transactionSettings.purchase.add.buttons) {
                    yamlContent += `  # Add amount buttons\n`;
                    yamlContent += `  add:\n`;
                    yamlContent += `    material: ${transactionSettings.purchase.add.material}\n`;
                    Object.keys(transactionSettings.purchase.add.buttons).forEach(amount => {
                        const btn = transactionSettings.purchase.add.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                    yamlContent += `\n`;
                }

                // Remove buttons
                if (transactionSettings.purchase.remove && transactionSettings.purchase.remove.buttons) {
                    yamlContent += `  # Remove amount buttons\n`;
                    yamlContent += `  remove:\n`;
                    yamlContent += `    material: ${transactionSettings.purchase.remove.material}\n`;
                    Object.keys(transactionSettings.purchase.remove.buttons).forEach(amount => {
                        const btn = transactionSettings.purchase.remove.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                    yamlContent += `\n`;
                }

                // Set buttons
                if (transactionSettings.purchase.set && transactionSettings.purchase.set.buttons) {
                    yamlContent += `  # Set amount buttons\n`;
                    yamlContent += `  set:\n`;
                    yamlContent += `    material: ${transactionSettings.purchase.set.material}\n`;
                    Object.keys(transactionSettings.purchase.set.buttons).forEach(amount => {
                        const btn = transactionSettings.purchase.set.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                }

                const response = await fetch(`${API_URL}/api/file/menus/purchase-menu.yml`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify({ content: yamlContent })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log('Saved purchase-menu.yml');
            } catch (error) {
                console.error('Failed to save purchase-menu.yml:', error);
                showAlert('Failed to save purchase-menu.yml: ' + error.message);
            }
        }

        // Save sell-menu.yml
        async function saveSellMenuYaml() {
            if (isLoadingFiles) {
                console.log('Skipping save - files are still loading');
                return;
            }

            try {
                let yamlContent = `# Sell menu configuration\n`;
                yamlContent += `# This file contains settings for the item selling interface\n\n`;
                yamlContent += `title-prefix: '${transactionSettings.sell.titlePrefix}'\n`;
                yamlContent += `display-material: ${transactionSettings.sell.displayMaterial}\n`;
                yamlContent += `display-slot: ${transactionSettings.sell.displaySlot}\n`;
                yamlContent += `max-amount: ${transactionSettings.sell.maxAmount}\n\n`;

                // Lore settings
                yamlContent += `# Display item lore placeholders\n`;
                yamlContent += `lore:\n`;
                yamlContent += `  selected-amount: '${document.getElementById('sell-lore-selected-amount').value}'\n`;
                yamlContent += `  sell-price: '${document.getElementById('sell-lore-sell-price').value}'\n`;
                yamlContent += `  you-own: '${document.getElementById('sell-lore-you-own').value}'\n`;
                yamlContent += `  spawner: '${document.getElementById('sell-lore-spawner').value}'\n\n`;

                // Buttons
                yamlContent += `# Action buttons\n`;
                yamlContent += `buttons:\n`;

                // Static buttons
                ['confirm', 'sell-all', 'cancel', 'back'].forEach(key => {
                    const btn = transactionSettings.sell.buttons[key];
                    if (btn) {
                        yamlContent += `  ${key}:\n`;
                        yamlContent += `    material: ${btn.material}\n`;
                        yamlContent += `    name: '${btn.name}'\n`;
                        if (btn.lore && btn.lore.length > 0) {
                            yamlContent += `    lore:\n`;
                            btn.lore.forEach(line => yamlContent += `      - '${line}'\n`);
                        }
                        yamlContent += `    slot: ${btn.slot}\n\n`;
                    }
                });

                // Add buttons
                if (transactionSettings.sell.add && transactionSettings.sell.add.buttons) {
                    yamlContent += `  # Add amount buttons\n`;
                    yamlContent += `  add:\n`;
                    yamlContent += `    material: ${transactionSettings.sell.add.material}\n`;
                    Object.keys(transactionSettings.sell.add.buttons).forEach(amount => {
                        const btn = transactionSettings.sell.add.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                    yamlContent += `\n`;
                }

                // Remove buttons
                if (transactionSettings.sell.remove && transactionSettings.sell.remove.buttons) {
                    yamlContent += `  # Remove amount buttons\n`;
                    yamlContent += `  remove:\n`;
                    yamlContent += `    material: ${transactionSettings.sell.remove.material}\n`;
                    Object.keys(transactionSettings.sell.remove.buttons).forEach(amount => {
                        const btn = transactionSettings.sell.remove.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                    yamlContent += `\n`;
                }

                // Set buttons
                if (transactionSettings.sell.set && transactionSettings.sell.set.buttons) {
                    yamlContent += `  # Set amount buttons\n`;
                    yamlContent += `  set:\n`;
                    yamlContent += `    material: ${transactionSettings.sell.set.material}\n`;
                    Object.keys(transactionSettings.sell.set.buttons).forEach(amount => {
                        const btn = transactionSettings.sell.set.buttons[amount];
                        yamlContent += `    '${amount}':\n`;
                        yamlContent += `      name: '${btn.name}'\n`;
                        yamlContent += `      slot: ${btn.slot}\n`;
                    });
                }

                const response = await fetch(`${API_URL}/api/file/menus/sell-menu.yml`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify({ content: yamlContent })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log('Saved sell-menu.yml');
            } catch (error) {
                console.error('Failed to save sell-menu.yml:', error);
                showAlert('Failed to save sell-menu.yml: ' + error.message);
            }
        }

        // Legacy: Save to old gui.yml format (deprecated)
        async function saveGuiYaml() {
            if (isLoadingFiles) {
                console.log('Skipping save - files are still loading');
                return;
            }

            // Clear existing timeout and set a new one
            if (saveGuiYamlTimeout) {
                clearTimeout(saveGuiYamlTimeout);
            }

            saveGuiYamlTimeout = setTimeout(async () => {
                await performGuiYamlSave();
            }, 500); // Wait 500ms after last change before saving
        }

        async function performGuiYamlSave() {
            // Generate ONLY the gui.main.items section
            let itemsYaml = '';

            loadedGuiShops.forEach(shop => {
                itemsYaml += `      ${shop.key}:\n`;
                itemsYaml += `        slot: ${shop.slot}\n`;
                itemsYaml += `        material: ${shop.material}\n`;
                itemsYaml += `        name: '${shop.name}'\n`;
                if (shop.lore && shop.lore.length > 0) {
                    itemsYaml += `        lore:\n`;
                    shop.lore.forEach(line => {
                        itemsYaml += `          - '${line}'\n`;
                    });
                }
                itemsYaml += `        shop-key: ${shop.shopKey}\n`;
                if (shop.permission && shop.permission.trim()) {
                    itemsYaml += `        permission: ${shop.permission}\n`;
                }
                if (shop.hideAttributes) {
                    itemsYaml += `        hide-attributes: true\n`;
                }
                if (shop.hideAdditional) {
                    itemsYaml += `        hide-additional: true\n`;
                }
            });

            // Reconstruct full gui.yml by replacing gui.main, purchase, and sell sections
            const lines = originalGuiYaml.split('\n');
            let yamlContent = '';
            let inGuiMain = false;
            let inPurchase = false;
            let inSell = false;
            let skipUntilNextSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                const indent = line.search(/\S/);

                // Detect gui.main section start
                if (indent === 2 && trimmed === 'main:' && !inGuiMain && !skipUntilNextSection) {
                    inGuiMain = true;
                    skipUntilNextSection = true;
                    yamlContent += line + '\n';
                    // Insert our generated main section
                    yamlContent += `    title: '${mainMenuTitle}'\n`;
                    yamlContent += `    rows: ${mainMenuRows}\n`;
                    yamlContent += `    items:\n`;
                    yamlContent += itemsYaml;
                    continue;
                }

                // Detect purchase section start
                if (indent === 2 && trimmed === 'purchase:' && !inPurchase && !skipUntilNextSection) {
                    inPurchase = true;
                    skipUntilNextSection = true;
                    yamlContent += line + '\n';
                    // Insert our generated purchase section
                    yamlContent += `    display-material: ${transactionSettings.purchase.displayMaterial}\n`;
                    yamlContent += `    title-prefix: '${transactionSettings.purchase.titlePrefix}'\n`;
                    yamlContent += `    display-slot: ${transactionSettings.purchase.displaySlot}\n`;
                    yamlContent += `    max-amount: ${transactionSettings.purchase.maxAmount}\n`;
                    yamlContent += `    # Lore lines\n`;
                    yamlContent += `    lore:\n`;
                    yamlContent += `      amount: '${document.getElementById('purchase-lore-amount').value}'\n`;
                    yamlContent += `      total: '${document.getElementById('purchase-lore-total').value}'\n`;
                    yamlContent += `      spawner: '${document.getElementById('purchase-lore-spawner').value}'\n`;
                    // Add buttons
                    yamlContent += `    buttons:\n`;
                    yamlContent += `      add:\n`;
                    ['1', '8', '64'].forEach(key => {
                        const btn = transactionSettings.purchase.buttons.add[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    yamlContent += `      remove:\n`;
                    ['1', '8', '64'].forEach(key => {
                        const btn = transactionSettings.purchase.buttons.remove[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    yamlContent += `      set:\n`;
                    ['16', '32', '64'].forEach(key => {
                        const btn = transactionSettings.purchase.buttons.set[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    // Add static buttons
                    ['confirm', 'cancel', 'back'].forEach(key => {
                        const btn = transactionSettings.purchase.buttons[key];
                        yamlContent += `      ${key}:\n`;
                        yamlContent += `        material: ${btn.material}\n`;
                        yamlContent += `        name: '${btn.name}'\n`;
                        yamlContent += `        slot: ${btn.slot}\n`;
                    });
                    continue;
                }

                // Detect sell section start
                if (indent === 2 && trimmed === 'sell:' && !inSell && !skipUntilNextSection) {
                    inSell = true;
                    skipUntilNextSection = true;
                    yamlContent += line + '\n';
                    // Insert our generated sell section
                    yamlContent += `    display-material: ${transactionSettings.sell.displayMaterial}\n`;
                    yamlContent += `    title-prefix: '${transactionSettings.sell.titlePrefix}'\n`;
                    yamlContent += `    display-slot: ${transactionSettings.sell.displaySlot}\n`;
                    yamlContent += `    max-amount: ${transactionSettings.sell.maxAmount}\n`;
                    yamlContent += `    # Lore lines\n`;
                    yamlContent += `    lore:\n`;
                    yamlContent += `      selected-amount: '${document.getElementById('sell-lore-selected-amount').value}'\n`;
                    yamlContent += `      sell-price: '${document.getElementById('sell-lore-sell-price').value}'\n`;
                    yamlContent += `      you-own: '${document.getElementById('sell-lore-you-own').value}'\n`;
                    yamlContent += `      spawner: '${document.getElementById('sell-lore-spawner').value}'\n`;
                    // Add buttons
                    yamlContent += `    buttons:\n`;
                    yamlContent += `      add:\n`;
                    ['1', '8', '64'].forEach(key => {
                        const btn = transactionSettings.sell.buttons.add[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    yamlContent += `      remove:\n`;
                    ['1', '8', '64'].forEach(key => {
                        const btn = transactionSettings.sell.buttons.remove[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    yamlContent += `      set:\n`;
                    ['16', '32', '64'].forEach(key => {
                        const btn = transactionSettings.sell.buttons.set[key];
                        yamlContent += `        '${key}':\n`;
                        yamlContent += `          material: ${btn.material}\n`;
                        yamlContent += `          name: '${btn.name}'\n`;
                        yamlContent += `          slot: ${btn.slot}\n`;
                    });
                    // Add static buttons
                    ['confirm', 'cancel', 'back'].forEach(key => {
                        const btn = transactionSettings.sell.buttons[key];
                        yamlContent += `      ${key}:\n`;
                        yamlContent += `        material: ${btn.material}\n`;
                        yamlContent += `        name: '${btn.name}'\n`;
                        yamlContent += `        slot: ${btn.slot}\n`;
                    });
                    continue;
                }

                // Skip old section content until we hit a section at indent 2
                if (skipUntilNextSection) {
                    if (indent === 2 && trimmed && !trimmed.startsWith('#') && trimmed.endsWith(':')) {
                        // Found next top-level section, stop skipping
                        skipUntilNextSection = false;
                        inGuiMain = false;
                        inPurchase = false;
                        inSell = false;
                        yamlContent += '\n' + line + '\n';
                        continue;
                    }
                    // Skip this line (it's old section content)
                    continue;
                }

                yamlContent += line + '\n';
            }

            // Check if content has actually changed
            if (originalGuiYaml === yamlContent) {
                console.log('No changes detected in gui.yml, skipping save');
                return;
            }

            // Save to server
            try {
                const response = await fetch(`${API_URL}/api/file/gui.yml`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify({ content: yamlContent })
                });

                if (response.status === 401) {
                    showAlert('Session expired. Please login again.', 'warning');
                    logout();
                    return;
                }

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log('gui.yml saved successfully');
                // Update cached version after successful save
                originalGuiYaml = yamlContent;
            } catch (error) {
                console.error('Failed to save gui.yml:', error);
                showAlert('Failed to save gui.yml: ' + error.message);
            }
        }

        // Parse main-menu.yml
        function parseMainMenuYaml(yamlContent) {
            loadedGuiShops = [];
            const lines = yamlContent.split('\n');
            let currentShop = null;
            let currentField = null;
            let inItems = false;

            console.log('=== PARSING MAIN MENU ===');
            console.log('Parsing main-menu.yml, total lines:', lines.length);
            console.log('First 50 lines of YAML content:');
            console.log(lines.slice(0, 50).map((l, i) => `${i}: ${JSON.stringify(l)}`).join('\n'));

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith('#')) continue;

                const indent = line.search(/\S/);

                // Debug: log every non-empty line in items section
                if (inItems && i < 100) {
                    console.log(`Line ${i}: indent=${indent}, inItems=${inItems}, currentShop=${currentShop?.key}, currentField=${currentField}, line=${JSON.stringify(line)}`);
                }

                // Look for title (indent 0)
                if (indent === 0 && trimmed.startsWith('title:')) {
                    const [, ...valueParts] = trimmed.split(':');
                    mainMenuTitle = valueParts.join(':').trim().replace(/['"]/g, '');
                    console.log('Found title:', mainMenuTitle);
                    document.getElementById('mainmenu-title').value = mainMenuTitle;
                    continue;
                }

                // Look for rows (indent 0)
                if (indent === 0 && trimmed.startsWith('rows:')) {
                    const [, ...valueParts] = trimmed.split(':');
                    mainMenuRows = parseInt(valueParts.join(':').trim()) || 3;
                    console.log('Found rows:', mainMenuRows);
                    document.getElementById('mainmenu-rows').value = mainMenuRows;
                    continue;
                }

                // Look for items section (indent 0)
                if (indent === 0 && trimmed === 'items:') {
                    inItems = true;
                    console.log('Found items section at line', i, 'setting inItems=true');
                    continue;
                }

                // Parse shop buttons (indent 2 = shop key)
                if (inItems && indent === 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    const shopKey = trimmed.split(':')[0].trim();
                    console.log('Found shop button at line', i, ':', shopKey, 'indent:', indent, 'line:', JSON.stringify(line));

                    // Debug check
                    console.log('Checking shop button condition: inItems=', inItems, 'indent=', indent, 'includes(":")=', trimmed.includes(':'), 'startsWith("-")=', trimmed.startsWith('-'));

                    // Save previous shop if valid
                    if (currentShop && currentShop.slot !== null) {
                        console.log('Saving previous shop:', currentShop.key, 'with', currentShop.lore.length, 'lore lines');
                        loadedGuiShops.push(currentShop);
                    }

                    currentShop = {
                        key: shopKey,
                        slot: null,
                        material: 'CHEST',
                        name: shopKey,
                        lore: [],
                        shopKey: shopKey,
                        permission: '',
                        hideAttributes: false,
                        hideAdditional: false,
                        requireName: false,
                        requireLore: false
                    };
                    currentField = null;
                }
                // Lore items (list format) - check this BEFORE regular properties
                // Lore items are at indent 4 with '-' prefix
                else if (currentField === 'lore' && indent === 4 && trimmed.startsWith('-')) {
                    const loreValue = trimmed.substring(1).trim().replace(/['"]/g, '');
                    console.log('Adding lore at line', i, 'indent:', indent, 'value:', JSON.stringify(loreValue), 'to shop:', currentShop?.key, 'line:', JSON.stringify(line));
                    if (currentShop) {
                        currentShop.lore.push(loreValue);
                    }
                }
                // Debug: if currentField is lore but we don't match the condition
                else if (currentField === 'lore' && trimmed && !trimmed.startsWith('#')) {
                    console.log('Skipped potential lore line at', i, 'currentField:', currentField, 'indent:', indent, 'trimmed:', JSON.stringify(trimmed), 'line:', JSON.stringify(line));
                }
                // Shop button properties (indent 4)
                else if (currentShop && indent === 4 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    // Exit lore section when we hit another property
                    if (currentField === 'lore') {
                        currentField = null;
                    }

                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'slot') {
                        currentShop.slot = parseInt(value);
                    } else if (key.trim() === 'material') {
                        currentShop.material = value;
                    } else if (key.trim() === 'name') {
                        currentShop.name = value;
                    } else if (key.trim() === 'lore') {
                        console.log('Setting currentField to lore at line', i, 'for shop:', currentShop.key, 'indent:', indent, 'line:', JSON.stringify(line));
                        currentField = 'lore';
                    } else if (key.trim() === 'shop-key') {
                        currentShop.shopKey = value;
                    } else if (key.trim() === 'permission') {
                        currentShop.permission = value;
                    } else if (key.trim() === 'hide-attributes') {
                        currentShop.hideAttributes = value.toLowerCase() === 'true';
                    } else if (key.trim() === 'hide-additional') {
                        currentShop.hideAdditional = value.toLowerCase() === 'true';
                    }
                }
            }

            // Add last shop if valid
            if (currentShop && currentShop.slot !== null) {
                console.log('Saving last shop:', currentShop.key, 'with', currentShop.lore.length, 'lore lines');
                loadedGuiShops.push(currentShop);
            }

            console.log(`Loaded ${loadedGuiShops.length} shop buttons from main-menu.yml`);
            console.log('Main menu title:', mainMenuTitle);
            console.log('Main menu rows:', mainMenuRows);
            console.log('All shops:', loadedGuiShops.map(s => ({ key: s.key, slot: s.slot, lore: s.lore.length, loreContent: s.lore })));

            // Detailed lore debug for each shop
            loadedGuiShops.forEach(shop => {
                console.log(`Shop "${shop.key}" (slot ${shop.slot}):`, {
                    loreCount: shop.lore.length,
                    lore: shop.lore
                });
            });
        }

        // Parse purchase-menu.yml
        function parsePurchaseMenuYaml(yamlContent) {
            const lines = yamlContent.split('\n');
            let inButtons = false;
            let currentButtonType = null;

            console.log('Parsing purchase-menu.yml');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                if (!trimmed || trimmed.startsWith('#')) continue;

                const indent = line.search(/\S/);
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim().replace(/['"]/g, '');

                // Top-level settings (indent 0)
                if (indent === 0) {
                    if (key.trim() === 'title-prefix') {
                        transactionSettings.purchase.titlePrefix = value;
                        document.getElementById('purchase-title-prefix').value = value;
                    } else if (key.trim() === 'display-material') {
                        transactionSettings.purchase.displayMaterial = value;
                        document.getElementById('purchase-display-material').value = value;
                    } else if (key.trim() === 'display-slot') {
                        transactionSettings.purchase.displaySlot = parseInt(value) || 22;
                        document.getElementById('purchase-display-slot').value = transactionSettings.purchase.displaySlot;
                    } else if (key.trim() === 'max-amount') {
                        transactionSettings.purchase.maxAmount = parseInt(value) || 2304;
                        document.getElementById('purchase-max-amount').value = transactionSettings.purchase.maxAmount;
                    } else if (trimmed === 'buttons:') {
                        inButtons = true;
                    }
                }
                // Lore settings (indent 2 under lore:)
                else if (indent === 2 && !inButtons) {
                    if (key.trim() === 'amount') {
                        document.getElementById('purchase-lore-amount').value = value;
                    } else if (key.trim() === 'total') {
                        document.getElementById('purchase-lore-total').value = value;
                    } else if (key.trim() === 'spawner') {
                        document.getElementById('purchase-lore-spawner').value = value;
                    }
                }
                // Button type (indent 2 under buttons:)
                else if (inButtons && indent === 2 && trimmed.endsWith(':')) {
                    currentButtonType = key.trim();
                }
                // Button properties
                else if (inButtons && currentButtonType && indent === 4) {
                    if (['confirm', 'cancel', 'back'].includes(currentButtonType)) {
                        // Static buttons
                        if (!transactionSettings.purchase.buttons[currentButtonType]) {
                            transactionSettings.purchase.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                        }
                        if (key.trim() === 'material') {
                            transactionSettings.purchase.buttons[currentButtonType].material = value;
                        } else if (key.trim() === 'name') {
                            transactionSettings.purchase.buttons[currentButtonType].name = value;
                        } else if (key.trim() === 'slot') {
                            transactionSettings.purchase.buttons[currentButtonType].slot = parseInt(value) || 0;
                        }
                    } else if (['add', 'remove', 'set'].includes(currentButtonType)) {
                        // Check if this is the material property for the group
                        if (key.trim() === 'material') {
                            if (!transactionSettings.purchase[currentButtonType]) {
                                transactionSettings.purchase[currentButtonType] = { material: 'STONE', buttons: {} };
                            }
                            transactionSettings.purchase[currentButtonType].material = value;
                        } else if (!trimmed.endsWith(':')) {
                            // Amount buttons - key is the amount
                            const amount = key.trim().replace(/['"]/g, '');
                            if (!transactionSettings.purchase[currentButtonType]) {
                                transactionSettings.purchase[currentButtonType] = { material: 'STONE', buttons: {} };
                            }
                            if (!transactionSettings.purchase[currentButtonType].buttons[amount]) {
                                transactionSettings.purchase[currentButtonType].buttons[amount] = { name: '', slot: 0 };
                            }
                        }
                    }
                }
                // Amount button properties (indent 6)
                else if (inButtons && currentButtonType && ['add', 'remove', 'set'].includes(currentButtonType) && indent === 6) {
                    const buttonKeys = Object.keys(transactionSettings.purchase[currentButtonType].buttons || {});
                    const lastKey = buttonKeys[buttonKeys.length - 1];
                    if (lastKey) {
                        if (key.trim() === 'name') {
                            transactionSettings.purchase[currentButtonType].buttons[lastKey].name = value;
                        } else if (key.trim() === 'slot') {
                            transactionSettings.purchase[currentButtonType].buttons[lastKey].slot = parseInt(value) || 0;
                        }
                    }
                }
            }

            console.log('Parsed purchase menu settings');
        }

        // Parse sell-menu.yml
        function parseSellMenuYaml(yamlContent) {
            const lines = yamlContent.split('\n');
            let inButtons = false;
            let currentButtonType = null;

            console.log('Parsing sell-menu.yml');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                if (!trimmed || trimmed.startsWith('#')) continue;

                const indent = line.search(/\S/);
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim().replace(/['"]/g, '');

                // Top-level settings (indent 0)
                if (indent === 0) {
                    if (key.trim() === 'title-prefix') {
                        transactionSettings.sell.titlePrefix = value;
                        document.getElementById('sell-title-prefix').value = value;
                    } else if (key.trim() === 'display-material') {
                        transactionSettings.sell.displayMaterial = value;
                        document.getElementById('sell-display-material').value = value;
                    } else if (key.trim() === 'display-slot') {
                        transactionSettings.sell.displaySlot = parseInt(value) || 22;
                        document.getElementById('sell-display-slot').value = transactionSettings.sell.displaySlot;
                    } else if (key.trim() === 'max-amount') {
                        transactionSettings.sell.maxAmount = parseInt(value) || 2304;
                        document.getElementById('sell-max-amount').value = transactionSettings.sell.maxAmount;
                    } else if (trimmed === 'buttons:') {
                        inButtons = true;
                    }
                }
                // Lore settings (indent 2 under lore:)
                else if (indent === 2 && !inButtons) {
                    if (key.trim() === 'selected-amount') {
                        document.getElementById('sell-lore-selected-amount').value = value;
                    } else if (key.trim() === 'sell-price') {
                        document.getElementById('sell-lore-sell-price').value = value;
                    } else if (key.trim() === 'you-own') {
                        document.getElementById('sell-lore-you-own').value = value;
                    } else if (key.trim() === 'spawner') {
                        document.getElementById('sell-lore-spawner').value = value;
                    }
                }
                // Button type (indent 2 under buttons:)
                else if (inButtons && indent === 2 && trimmed.endsWith(':')) {
                    currentButtonType = key.trim();
                }
                // Button properties
                else if (inButtons && currentButtonType && indent === 4) {
                    if (['confirm', 'sell-all', 'cancel', 'back'].includes(currentButtonType)) {
                        // Static buttons
                        if (!transactionSettings.sell.buttons[currentButtonType]) {
                            transactionSettings.sell.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                        }
                        if (key.trim() === 'material') {
                            transactionSettings.sell.buttons[currentButtonType].material = value;
                        } else if (key.trim() === 'name') {
                            transactionSettings.sell.buttons[currentButtonType].name = value;
                        } else if (key.trim() === 'slot') {
                            transactionSettings.sell.buttons[currentButtonType].slot = parseInt(value) || 0;
                        }
                    } else if (['add', 'remove', 'set'].includes(currentButtonType)) {
                        // Check if this is the material property for the group
                        if (key.trim() === 'material') {
                            if (!transactionSettings.sell[currentButtonType]) {
                                transactionSettings.sell[currentButtonType] = { material: 'STONE', buttons: {} };
                            }
                            transactionSettings.sell[currentButtonType].material = value;
                        } else if (!trimmed.endsWith(':')) {
                            // Amount buttons - key is the amount
                            const amount = key.trim().replace(/['"]/g, '');
                            if (!transactionSettings.sell[currentButtonType]) {
                                transactionSettings.sell[currentButtonType] = { material: 'STONE', buttons: {} };
                            }
                            if (!transactionSettings.sell[currentButtonType].buttons[amount]) {
                                transactionSettings.sell[currentButtonType].buttons[amount] = { name: '', slot: 0 };
                            }
                        }
                    }
                }
                // Amount button properties (indent 6)
                else if (inButtons && currentButtonType && ['add', 'remove', 'set'].includes(currentButtonType) && indent === 6) {
                    const buttonKeys = Object.keys(transactionSettings.sell[currentButtonType].buttons || {});
                    const lastKey = buttonKeys[buttonKeys.length - 1];
                    if (lastKey) {
                        if (key.trim() === 'name') {
                            transactionSettings.sell[currentButtonType].buttons[lastKey].name = value;
                        } else if (key.trim() === 'slot') {
                            transactionSettings.sell[currentButtonType].buttons[lastKey].slot = parseInt(value) || 0;
                        }
                    }
                }
            }

            console.log('Parsed sell menu settings');
        }

        // Legacy: Simple YAML parser for old gui.yml format
        function parseGuiYaml(yamlContent) {
            loadedGuiShops = [];
            const lines = yamlContent.split('\n');
            let currentShop = null;
            let currentField = null;
            let inGuiMain = false;
            let inGuiMainItems = false;

            console.log('Parsing gui.yml, total lines:', lines.length);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith('#')) continue;

                // Check indentation level
                const indent = line.search(/\S/);

                // Debug: Log lines we're checking
                if (i < 30 || (inGuiMainItems && i < 100)) {
                    console.log(`Line ${i}: indent=${indent}, trimmed="${trimmed.substring(0, 50)}"`);
                }

                // Look for gui.main section (indent 2)
                if (indent === 2 && trimmed === 'main:') {
                    inGuiMain = true;
                    console.log('Found gui.main section at line', i);
                    continue;
                }

                // Look for gui.main.title (indent 4)
                if (inGuiMain && indent === 4 && trimmed.startsWith('title:')) {
                    const [, ...valueParts] = trimmed.split(':');
                    mainMenuTitle = valueParts.join(':').trim().replace(/['"]/g, '');
                    console.log('Found main menu title:', mainMenuTitle);
                    document.getElementById('mainmenu-title').value = mainMenuTitle;
                    continue;
                }

                // Look for gui.main.rows (indent 4)
                if (inGuiMain && indent === 4 && trimmed.startsWith('rows:')) {
                    const [, ...valueParts] = trimmed.split(':');
                    mainMenuRows = parseInt(valueParts.join(':').trim()) || 3;
                    console.log('Found main menu rows:', mainMenuRows);
                    document.getElementById('mainmenu-rows').value = mainMenuRows;
                    continue;
                }

                // Look for gui.main.items section (indent 4)
                if (inGuiMain && indent === 4 && trimmed === 'items:') {
                    inGuiMainItems = true;
                    console.log('Found gui.main.items section at line', i);
                    continue;
                }

                // Exit gui.main section when indent goes back to 2 (new top-level section)
                if (inGuiMain && !inGuiMainItems && indent === 2 && trimmed.endsWith(':')) {
                    inGuiMain = false;
                    console.log('Exited gui.main section at line', i);
                    continue;
                }

                // Exit gui.main.items when we hit another top-level gui section (indent 2)
                if (inGuiMainItems && indent === 2 && trimmed.endsWith(':')) {
                    // Save the last shop before exiting
                    if (currentShop && currentShop.slot !== null) {
                        loadedGuiShops.push(currentShop);
                        console.log('Saved final shop before exiting:', currentShop.key);
                    }
                    inGuiMain = false;
                    inGuiMainItems = false;
                    currentShop = null;
                    currentField = null;
                    console.log('Exited gui.main.items section at line', i);
                    continue;
                }

                // If we're in items section, parse shop buttons (indent 6 = shop key)
                if (inGuiMainItems && indent === 6 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    const shopKey = trimmed.split(':')[0].trim();
                    console.log('Found shop button at line', i, 'with indent', indent, ':', shopKey);

                    // Save previous shop if valid
                    if (currentShop && currentShop.slot !== null) {
                        loadedGuiShops.push(currentShop);
                    }

                    currentShop = {
                        key: shopKey,
                        slot: null,
                        material: 'CHEST',
                        name: shopKey,
                        lore: [],
                        shopKey: shopKey,
                        permission: '',
                        hideAttributes: false,
                        hideAdditional: false,
                        requireName: false,
                        requireLore: false
                    };
                    currentField = null;
                    console.log('Parsing shop button:', shopKey);
                }
                // Shop button properties (indent 8 = properties of shop key)
                else if (currentShop && indent === 8 && trimmed.includes(':') && !trimmed.startsWith('-')) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'slot') {
                        currentShop.slot = parseInt(value);
                        console.log('  Set slot:', currentShop.slot);
                    } else if (key.trim() === 'material') {
                        currentShop.material = value;
                        console.log('  Set material:', value);
                    } else if (key.trim() === 'name') {
                        currentShop.name = value;
                        console.log('  Set name:', value);
                    } else if (key.trim() === 'lore') {
                        currentField = 'lore';
                        console.log('  Found lore section');
                    } else if (key.trim() === 'shop-key') {
                        currentShop.shopKey = value;
                        console.log('  Set shop-key:', value);
                    } else if (key.trim() === 'permission') {
                        currentShop.permission = value;
                        console.log('  Set permission:', value);
                    } else if (key.trim() === 'hide-attributes') {
                        currentShop.hideAttributes = value.toLowerCase() === 'true';
                        console.log('  Set hide-attributes:', currentShop.hideAttributes);
                    } else if (key.trim() === 'hide-additional') {
                        currentShop.hideAdditional = value.toLowerCase() === 'true';
                        console.log('  Set hide-additional:', currentShop.hideAdditional);
                    }
                }
                // Lore items (indent 8 = list items at same level as lore:)
                else if (currentField === 'lore' && indent === 8 && trimmed.startsWith('-')) {
                    const loreValue = trimmed.substring(1).trim().replace(/['"]/g, '');
                    currentShop.lore.push(loreValue);
                    console.log('  Added lore line:', loreValue);
                }
                // Exit lore section when we hit another property at indent 8
                else if (currentField === 'lore' && indent === 8 && !trimmed.startsWith('-') && trimmed.includes(':')) {
                    currentField = null;
                }
            }

            // Add last shop if valid (only if we didn't already save it when exiting the section)
            if (currentShop && currentShop.slot !== null && inGuiMainItems) {
                loadedGuiShops.push(currentShop);
                console.log('Saved final shop at end of file:', currentShop.key);
            }

            console.log(`Loaded ${loadedGuiShops.length} shop buttons from gui.yml`);
            console.log('Main menu title:', mainMenuTitle);
            console.log('Main menu rows:', mainMenuRows);

            // Render the main menu shops in the UI
            renderMainMenuShops();

            // Parse purchase and sell settings
            parseTransactionSettings(yamlContent);
        }

        function parseTransactionSettings(yamlContent) {
            const lines = yamlContent.split('\n');
            let inPurchase = false;
            let inSell = false;
            let inPurchaseLore = false;
            let inSellLore = false;
            let inPurchaseButtons = false;
            let inSellButtons = false;
            let currentButtonType = null; // 'add', 'remove', 'set'

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const indent = line.search(/\S/);

                // Detect purchase section (indent 2)
                if (indent === 2 && trimmed === 'purchase:') {
                    inPurchase = true;
                    inSell = false;
                    inPurchaseLore = false;
                    inPurchaseButtons = false;
                    currentButtonType = null;
                    continue;
                }

                // Detect sell section (indent 2)
                if (indent === 2 && trimmed === 'sell:') {
                    inSell = true;
                    inPurchase = false;
                    inSellLore = false;
                    inSellButtons = false;
                    currentButtonType = null;
                    continue;
                }

                // Exit section when we hit another indent 2 section
                if (indent === 2 && trimmed.endsWith(':')) {
                    inPurchase = false;
                    inSell = false;
                    inPurchaseLore = false;
                    inSellLore = false;
                    inPurchaseButtons = false;
                    inSellButtons = false;
                    currentButtonType = null;
                }

                // Detect lore section in purchase (indent 4)
                if (inPurchase && indent === 4 && trimmed === 'lore:') {
                    inPurchaseLore = true;
                    inPurchaseButtons = false;
                    currentButtonType = null;
                    continue;
                }

                // Detect sell section in sell (indent 4)
                if (inSell && indent === 4 && trimmed === 'lore:') {
                    inSellLore = true;
                    inSellButtons = false;
                    currentButtonType = null;
                    continue;
                }

                // Detect buttons section in purchase (indent 4)
                if (inPurchase && indent === 4 && trimmed === 'buttons:') {
                    inPurchaseButtons = true;
                    inPurchaseLore = false;
                    currentButtonType = null;
                    continue;
                }

                // Detect buttons section in sell (indent 4)
                if (inSell && indent === 4 && trimmed === 'buttons:') {
                    inSellButtons = true;
                    inSellLore = false;
                    currentButtonType = null;
                    continue;
                }

                // Detect button type within buttons section (indent 6: add/remove/set/confirm/cancel/back)
                if (inPurchaseButtons && indent === 6 && trimmed.endsWith(':')) {
                    const buttonType = trimmed.slice(0, -1);
                    if (['add', 'remove', 'set', 'confirm', 'cancel', 'back'].includes(buttonType)) {
                        currentButtonType = buttonType;
                    }
                    continue;
                }

                if (inSellButtons && indent === 6 && trimmed.endsWith(':')) {
                    const buttonType = trimmed.slice(0, -1);
                    if (['add', 'remove', 'set', 'confirm', 'cancel', 'back'].includes(buttonType)) {
                        currentButtonType = buttonType;
                    }
                    continue;
                }

                // Exit subsections when we hit another indent 4 section
                if (indent === 4 && trimmed.endsWith(':')) {
                    inPurchaseLore = false;
                    inSellLore = false;
                    // Don't exit buttons section here, let it be handled above
                }

                // Parse purchase lore settings (indent 6)
                if (inPurchase && inPurchaseLore && indent === 6) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'amount') {
                        document.getElementById('purchase-lore-amount').value = value;
                    } else if (key.trim() === 'total') {
                        document.getElementById('purchase-lore-total').value = value;
                    } else if (key.trim() === 'spawner') {
                        document.getElementById('purchase-lore-spawner').value = value;
                    }
                }

                // Parse sell lore settings (indent 6)
                if (inSell && inSellLore && indent === 6) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'selected-amount') {
                        document.getElementById('sell-lore-selected-amount').value = value;
                    } else if (key.trim() === 'sell-price') {
                        document.getElementById('sell-lore-sell-price').value = value;
                    } else if (key.trim() === 'you-own') {
                        document.getElementById('sell-lore-you-own').value = value;
                    } else if (key.trim() === 'spawner') {
                        document.getElementById('sell-lore-spawner').value = value;
                    }
                }

                // Parse button properties for purchase (indent 8 or 10 depending on button type)
                if (inPurchaseButtons && currentButtonType && (indent === 8 || indent === 10)) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const keyName = key.trim().replace(/['"]/g, '');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    // For add/remove/set buttons, indent 8 is the key (1, 8, 64, etc.)
                    if (indent === 8 && ['add', 'remove', 'set'].includes(currentButtonType)) {
                        const buttonKey = keyName;
                        if (!transactionSettings.purchase.buttons[currentButtonType]) {
                            transactionSettings.purchase.buttons[currentButtonType] = {};
                        }
                        if (!transactionSettings.purchase.buttons[currentButtonType][buttonKey]) {
                            transactionSettings.purchase.buttons[currentButtonType][buttonKey] = { material: 'STONE', name: '', slot: 0 };
                        }
                    }
                    // Indent 10 is the properties (material, name, slot)
                    else if (indent === 10 && ['add', 'remove', 'set'].includes(currentButtonType)) {
                        // Find the last button key we're working with
                        const buttonKeys = Object.keys(transactionSettings.purchase.buttons[currentButtonType] || {});
                        const lastKey = buttonKeys[buttonKeys.length - 1];
                        if (lastKey) {
                            if (keyName === 'material') {
                                transactionSettings.purchase.buttons[currentButtonType][lastKey].material = value;
                            } else if (keyName === 'name') {
                                transactionSettings.purchase.buttons[currentButtonType][lastKey].name = value;
                            } else if (keyName === 'slot') {
                                transactionSettings.purchase.buttons[currentButtonType][lastKey].slot = parseInt(value) || 0;
                            }
                        }
                    }
                    // For static buttons (confirm/cancel/back), indent 8 is the property
                    else if (indent === 8 && ['confirm', 'cancel', 'back'].includes(currentButtonType)) {
                        if (!transactionSettings.purchase.buttons[currentButtonType]) {
                            transactionSettings.purchase.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                        }
                        if (keyName === 'material') {
                            transactionSettings.purchase.buttons[currentButtonType].material = value;
                        } else if (keyName === 'name') {
                            transactionSettings.purchase.buttons[currentButtonType].name = value;
                        } else if (keyName === 'slot') {
                            transactionSettings.purchase.buttons[currentButtonType].slot = parseInt(value) || 0;
                        }
                    }
                }

                // Parse button properties for sell (same logic as purchase)
                if (inSellButtons && currentButtonType && (indent === 8 || indent === 10)) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const keyName = key.trim().replace(/['"]/g, '');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (indent === 8 && ['add', 'remove', 'set'].includes(currentButtonType)) {
                        const buttonKey = keyName;
                        if (!transactionSettings.sell.buttons[currentButtonType]) {
                            transactionSettings.sell.buttons[currentButtonType] = {};
                        }
                        if (!transactionSettings.sell.buttons[currentButtonType][buttonKey]) {
                            transactionSettings.sell.buttons[currentButtonType][buttonKey] = { material: 'STONE', name: '', slot: 0 };
                        }
                    }
                    else if (indent === 10 && ['add', 'remove', 'set'].includes(currentButtonType)) {
                        const buttonKeys = Object.keys(transactionSettings.sell.buttons[currentButtonType] || {});
                        const lastKey = buttonKeys[buttonKeys.length - 1];
                        if (lastKey) {
                            if (keyName === 'material') {
                                transactionSettings.sell.buttons[currentButtonType][lastKey].material = value;
                            } else if (keyName === 'name') {
                                transactionSettings.sell.buttons[currentButtonType][lastKey].name = value;
                            } else if (keyName === 'slot') {
                                transactionSettings.sell.buttons[currentButtonType][lastKey].slot = parseInt(value) || 0;
                            }
                        }
                    }
                    else if (indent === 8 && ['confirm', 'cancel', 'back'].includes(currentButtonType)) {
                        if (!transactionSettings.sell.buttons[currentButtonType]) {
                            transactionSettings.sell.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                        }
                        if (keyName === 'material') {
                            transactionSettings.sell.buttons[currentButtonType].material = value;
                        } else if (keyName === 'name') {
                            transactionSettings.sell.buttons[currentButtonType].name = value;
                        } else if (keyName === 'slot') {
                            transactionSettings.sell.buttons[currentButtonType].slot = parseInt(value) || 0;
                        }
                    }
                }

                // Parse purchase settings (indent 4)
                if (inPurchase && indent === 4 && !inPurchaseLore && !inPurchaseButtons) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'display-material') {
                        transactionSettings.purchase.displayMaterial = value;
                        document.getElementById('purchase-display-material').value = value;
                    } else if (key.trim() === 'title-prefix') {
                        transactionSettings.purchase.titlePrefix = value;
                        document.getElementById('purchase-title-prefix').value = value;
                    } else if (key.trim() === 'display-slot') {
                        transactionSettings.purchase.displaySlot = parseInt(value) || 22;
                        document.getElementById('purchase-display-slot').value = transactionSettings.purchase.displaySlot;
                    } else if (key.trim() === 'max-amount') {
                        transactionSettings.purchase.maxAmount = parseInt(value) || 2304;
                        document.getElementById('purchase-max-amount').value = transactionSettings.purchase.maxAmount;
                    }
                }

                // Parse sell settings (indent 4)
                if (inSell && indent === 4 && !inSellLore && !inSellButtons) {
                    const [key, ...valueParts] = trimmed.split(':');
                    const value = valueParts.join(':').trim().replace(/['"]/g, '');

                    if (key.trim() === 'display-material') {
                        transactionSettings.sell.displayMaterial = value;
                        document.getElementById('sell-display-material').value = value;
                    } else if (key.trim() === 'title-prefix') {
                        transactionSettings.sell.titlePrefix = value;
                        document.getElementById('sell-title-prefix').value = value;
                    } else if (key.trim() === 'display-slot') {
                        transactionSettings.sell.displaySlot = parseInt(value) || 22;
                        document.getElementById('sell-display-slot').value = transactionSettings.sell.displaySlot;
                    } else if (key.trim() === 'max-amount') {
                        transactionSettings.sell.maxAmount = parseInt(value) || 2304;
                        document.getElementById('sell-max-amount').value = transactionSettings.sell.maxAmount;
                    }
                }
            }

            console.log('Parsed transaction settings:', transactionSettings);
        }

        function updateTransactionSettings() {
            if (isLoadingFiles) return;

            // Update from form
            transactionSettings.purchase.displayMaterial = document.getElementById('purchase-display-material').value;
            transactionSettings.purchase.titlePrefix = document.getElementById('purchase-title-prefix').value;
            transactionSettings.purchase.displaySlot = parseInt(document.getElementById('purchase-display-slot').value) || 22;
            transactionSettings.purchase.maxAmount = parseInt(document.getElementById('purchase-max-amount').value) || 2304;

            transactionSettings.sell.displayMaterial = document.getElementById('sell-display-material').value;
            transactionSettings.sell.titlePrefix = document.getElementById('sell-title-prefix').value;
            transactionSettings.sell.displaySlot = parseInt(document.getElementById('sell-display-slot').value) || 22;
            transactionSettings.sell.maxAmount = parseInt(document.getElementById('sell-max-amount').value) || 2304;

            // Save to sell-menu.yml
            saveSellMenuYaml();
        }

        // Purchase menu functions
        function updatePurchaseSettings() {
            if (isLoadingFiles) return;
            transactionSettings.purchase.titlePrefix = document.getElementById('purchase-title-prefix').value;
            transactionSettings.purchase.displaySlot = parseInt(document.getElementById('purchase-display-slot').value) || 22;
            transactionSettings.purchase.maxAmount = parseInt(document.getElementById('purchase-max-amount').value) || 2304;
            savePurchaseMenuYaml();
        }

        function updatePurchasePreview() {
            transactionSettings.purchase.displayMaterial = document.getElementById('purchase-display-material').value;
            transactionSettings.purchase.titlePrefix = document.getElementById('purchase-title-prefix').value;
            transactionSettings.purchase.displaySlot = parseInt(document.getElementById('purchase-display-slot').value) || 22;
            renderTransactionPreview('purchase');
        }

        function renderPurchaseButtons() {
            const container = document.getElementById('purchase-buttons-list');
            container.innerHTML = '';

            // Add buttons section
            renderButtonGroup(container, 'purchase', 'add', 'ADD Buttons', '&aAdd');

            // Remove buttons section
            renderButtonGroup(container, 'purchase', 'remove', 'REMOVE Buttons', '&cRemove');

            // Set buttons section
            renderButtonGroup(container, 'purchase', 'set', 'SET Buttons', '&eSet to');
        }

        function updatePurchaseButton(key, field, value) {
            if (transactionSettings.purchase.buttons[key]) {
                transactionSettings.purchase.buttons[key][field] = value;
                updatePurchasePreview();
                if (!isLoadingFiles) savePurchaseMenuYaml();
            }
        }

        // Sell menu functions
        function updateSellSettings() {
            if (isLoadingFiles) return;
            transactionSettings.sell.titlePrefix = document.getElementById('sell-title-prefix').value;
            transactionSettings.sell.displaySlot = parseInt(document.getElementById('sell-display-slot').value) || 22;
            transactionSettings.sell.maxAmount = parseInt(document.getElementById('sell-max-amount').value) || 2304;
            saveSellMenuYaml();
        }

        function updateSellPreview() {
            transactionSettings.sell.displayMaterial = document.getElementById('sell-display-material').value;
            transactionSettings.sell.titlePrefix = document.getElementById('sell-title-prefix').value;
            transactionSettings.sell.displaySlot = parseInt(document.getElementById('sell-display-slot').value) || 22;
            renderTransactionPreview('sell');
        }

        function renderSellButtons() {
            const container = document.getElementById('sell-buttons-list');
            container.innerHTML = '';

            // Add buttons section
            renderButtonGroup(container, 'sell', 'add', 'ADD Buttons', '&aAdd');

            // Remove buttons section
            renderButtonGroup(container, 'sell', 'remove', 'REMOVE Buttons', '&cRemove');

            // Set buttons section
            renderButtonGroup(container, 'sell', 'set', 'SET Buttons', '&eSet to');
        }

        function updateSellButton(key, field, value) {
            if (transactionSettings.sell.buttons[key]) {
                transactionSettings.sell.buttons[key][field] = value;
                updateSellPreview();
                if (!isLoadingFiles) saveSellMenuYaml();
            }
        }

        // Render button group (add/remove/set) with ability to add custom buttons
        function renderButtonGroup(container, type, group, title, namePrefix) {
            const settings = transactionSettings[type][group];

            // Create section header with add button
            const header = document.createElement('div');
            header.style.cssText = 'margin-top: 20px; margin-bottom: 15px;';
            header.innerHTML = `
                <button class="btn btn-success" onclick="addCustomButton('${type}', '${group}')" style="width: 100%; padding: 12px; font-size: 0.9em;">
                    ➕ ADD ${title.replace(' Buttons', '').toUpperCase()}
                </button>
            `;
            container.appendChild(header);
        }

        function updateButtonGroupMaterial(type, group, material) {
            transactionSettings[type][group].material = material;
            if (type === 'purchase') {
                renderPurchaseButtons();
                updatePurchasePreview();
            } else {
                renderSellButtons();
                updateSellPreview();
            }
            if (!isLoadingFiles) {
                if (type === 'purchase') {
                    savePurchaseMenuYaml();
                } else {
                    saveSellMenuYaml();
                }
            }
        }

        function updateGroupButton(type, group, amount, field, value) {
            if (transactionSettings[type][group].buttons[amount]) {
                transactionSettings[type][group].buttons[amount][field] = value;
                if (type === 'purchase') {
                    updatePurchasePreview();
                } else {
                    updateSellPreview();
                }
                if (!isLoadingFiles) {
                    if (type === 'purchase') {
                        savePurchaseMenuYaml();
                    } else {
                        saveSellMenuYaml();
                    }
                }
            }
        }

        // Check if a slot is already occupied in main menu
        function isMainMenuSlotOccupied(slot, excludeIndex = null) {
            for (let i = 0; i < loadedGuiShops.length; i++) {
                if (i === excludeIndex) continue; // Skip the button being edited
                if (loadedGuiShops[i].slot === slot) {
                    return { occupied: true, location: loadedGuiShops[i].name || loadedGuiShops[i].key };
                }
            }
            return { occupied: false };
        }

        // Check if a slot is already occupied in transaction menu
        function isSlotOccupied(type, slot, excludeGroup = null, excludeAmount = null) {
            const settings = transactionSettings[type];

            // Check display slot
            if (settings.displaySlot === slot) {
                return { occupied: true, location: 'Display Item' };
            }

            // Check main buttons
            for (const [key, btn] of Object.entries(settings.buttons)) {
                if (btn.slot === slot) {
                    return { occupied: true, location: `${key.toUpperCase()} button` };
                }
            }

            // Check add/remove/set button groups
            for (const groupName of ['add', 'remove', 'set']) {
                if (settings[groupName] && settings[groupName].buttons) {
                    for (const [amount, btn] of Object.entries(settings[groupName].buttons)) {
                        // Skip the button we're editing
                        if (groupName === excludeGroup && amount === excludeAmount) {
                            continue;
                        }
                        if (btn.slot === slot) {
                            return { occupied: true, location: `${groupName.toUpperCase()} ${amount} button` };
                        }
                    }
                }
            }

            return { occupied: false };
        }

        function addCustomButton(type, group) {
            const namePrefix = group === 'add' ? '&aAdd' : group === 'remove' ? '&cRemove' : '&eSet to';

            // Create modal for adding button
            const content = `
                <div class="form-group">
                    <label>Amount/Value</label>
                    <input type="text" id="modal-new-amount" placeholder="e.g., 32, 16, etc.">
                </div>
                <div class="form-group">
                    <label>Button Name (use & for colors)</label>
                    <input type="text" id="modal-new-name" value="${namePrefix} " placeholder="${namePrefix} 32">
                </div>
                <div class="form-group">
                    <label>Slot (0-53)</label>
                    <input type="number" id="modal-new-slot" min="0" max="53" value="0">
                </div>
            `;

            openEditModal({
                title: `Add ${type.toUpperCase()}: ${group.toUpperCase()} Button`,
                content,
                onSave: () => {
                    const amount = document.getElementById('modal-new-amount').value;
                    const name = document.getElementById('modal-new-name').value;
                    const slot = parseInt(document.getElementById('modal-new-slot').value) || 0;

                    if (!amount || !amount.trim()) {
                        showAlert('Amount is required', 'warning');
                        return;
                    }

                    // Check for slot conflicts
                    const slotCheck = isSlotOccupied(type, slot);
                    if (slotCheck.occupied) {
                        showAlert(`Slot ${slot} is already occupied by ${slotCheck.location}. Please choose a different slot.`, 'warning');
                        return;
                    }

                    if (!transactionSettings[type][group]) {
                        transactionSettings[type][group] = { material: 'STONE', buttons: {} };
                    }
                    if (!transactionSettings[type][group].buttons) {
                        transactionSettings[type][group].buttons = {};
                    }

                    transactionSettings[type][group].buttons[amount] = {
                        name: name || `${namePrefix} ${amount}`,
                        slot: slot
                    };

                    // Log the creation
                    addActivityEntry('created', `${type}-menu-button`, null, {
                        type: type,
                        group: group,
                        amount: amount,
                        name: name || `${namePrefix} ${amount}`,
                        slot: slot
                    });

                    if (type === 'purchase') {
                        renderPurchaseButtons();
                        updatePurchasePreview();
                    } else {
                        renderSellButtons();
                        updateSellPreview();
                    }
                    if (!isLoadingFiles) {
                        if (type === 'purchase') {
                            savePurchaseMenuYaml();
                        } else {
                            saveSellMenuYaml();
                        }
                    }
                    closeEditModal();
                }
            });
        }

        async function removeCustomButton(type, group, amount) {
            const confirmed = await showConfirm(`Remove ${group} ${amount} button?`);
            if (confirmed) {
                if (transactionSettings[type][group] && transactionSettings[type][group].buttons) {
                    // Log before deletion
                    const beforeData = JSON.parse(JSON.stringify(transactionSettings[type][group].buttons[amount]));
                    addActivityEntry('deleted', `${type}-menu-button`, {
                        type: type,
                        group: group,
                        amount: amount,
                        ...beforeData
                    }, null);

                    delete transactionSettings[type][group].buttons[amount];
                }
                if (type === 'purchase') {
                    renderPurchaseButtons();
                    updatePurchasePreview();
                } else {
                    renderSellButtons();
                    updateSellPreview();
                }
                if (!isLoadingFiles) {
                    if (type === 'purchase') {
                        savePurchaseMenuYaml();
                    } else {
                        saveSellMenuYaml();
                    }
                }
            }
        }

        function changeButtonAmount(type, group, oldAmount, newAmount) {
            if (!newAmount || newAmount === oldAmount) return;

            const btn = transactionSettings[type][group].buttons[oldAmount];
            delete transactionSettings[type][group].buttons[oldAmount];

            // Update the name with new amount
            const namePrefix = group === 'add' ? '&aAdd' : group === 'remove' ? '&cRemove' : '&eSet to';
            transactionSettings[type][group].buttons[newAmount] = {
                ...btn,
                name: `${namePrefix} ${newAmount}`
            };

            if (type === 'purchase') {
                renderPurchaseButtons();
                updatePurchasePreview();
            } else {
                renderSellButtons();
                updateSellPreview();
            }
            if (!isLoadingFiles) {
                if (type === 'purchase') {
                    savePurchaseMenuYaml();
                } else {
                    saveSellMenuYaml();
                }
            }
        }

        function scrollToTransactionButton(type, group, key) {
            const cardId = `transaction-btn-${type}-${group}-${key}`;
            const card = document.getElementById(cardId);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight the card briefly
                card.style.transition = 'box-shadow 0.3s ease';
                card.style.boxShadow = '0 0 20px rgba(255, 212, 96, 0.8)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 1500);
            }
        }

        // Render transaction preview (purchase or sell)
        function renderTransactionPreview(type) {
            const settings = transactionSettings[type];
            const grid = document.getElementById('preview-grid');
            grid.innerHTML = '';

            // Create 6 rows (54 slots)
            for (let i = 0; i < 54; i++) {
                const slot = document.createElement('div');
                slot.className = 'gui-slot';

                // Check if this is the display slot
                if (i === settings.displaySlot) {
                    slot.classList.add('filled');
                    slot.style.cursor = 'pointer';
                    const textureUrl = getItemTexture(settings.displayMaterial);
                    slot.innerHTML = `
                        <div class="item-icon">
                            <img src="${textureUrl}" alt="${settings.displayMaterial}"
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                        </div>
                    `;

                    // Add click to open display item modal
                    slot.addEventListener('click', () => {
                        openDisplayItemModal(type);
                    });

                    slot.addEventListener('mouseenter', (e) => {
                        const tooltip = document.getElementById('item-tooltip');
                        let tooltipHTML = `<div class="tooltip-title">${parseMinecraftColors(settings.titlePrefix + settings.displayMaterial)}</div>`;

                        // Add lore lines based on type
                        if (type === 'purchase') {
                            const amountLore = document.getElementById('purchase-lore-amount').value;
                            const totalLore = document.getElementById('purchase-lore-total').value;
                            const spawnerLore = document.getElementById('purchase-lore-spawner').value;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(amountLore)}1</div>`;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(totalLore)}$100</div>`;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(spawnerLore)}PIG</div>`;
                        } else {
                            const selectedAmountLore = document.getElementById('sell-lore-selected-amount').value;
                            const sellPriceLore = document.getElementById('sell-lore-sell-price').value;
                            const youOwnLore = document.getElementById('sell-lore-you-own').value;
                            const spawnerLore = document.getElementById('sell-lore-spawner').value;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(selectedAmountLore)}1</div>`;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(sellPriceLore)}$50</div>`;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(youOwnLore)}64</div>`;
                            tooltipHTML += `<div class="tooltip-line">${parseMinecraftColors(spawnerLore)}PIG</div>`;
                        }

                        tooltipHTML += `<div class="tooltip-line" style="color:#55ffff; margin-top:4px;">Click to edit</div>`;
                        tooltip.innerHTML = tooltipHTML;
                        tooltip.classList.add('show');
                        moveMinecraftTooltip(e);
                    });
                    slot.addEventListener('mousemove', moveMinecraftTooltip);
                    slot.addEventListener('mouseleave', hideMinecraftTooltip);
                }

                // Check if this is a main button slot
                Object.entries(settings.buttons).forEach(([key, btn]) => {
                    if (i === btn.slot) {
                        slot.classList.add('filled');
                        slot.style.cursor = 'pointer';
                        const textureUrl = getItemTexture(btn.material);
                        const displayName = parseMinecraftColors(btn.name);
                        slot.innerHTML = `
                            <div class="item-icon">
                                <img src="${textureUrl}" alt="${btn.material}"
                                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                            </div>
                        `;

                        // Add click to open modal editor
                        slot.addEventListener('click', () => {
                            openTransactionButtonModal(type, 'main', key);
                        });

                        slot.addEventListener('mouseenter', (e) => {
                            const tooltip = document.getElementById('item-tooltip');
                            tooltip.innerHTML = `<div class="tooltip-title">${displayName}</div>
                                <div class="tooltip-line" style="color:#aaa;">Slot: ${i}</div>
                                <div class="tooltip-line" style="color:#55ffff; margin-top:4px;">Click to edit</div>`;
                            tooltip.classList.add('show');
                            moveMinecraftTooltip(e);
                        });
                        slot.addEventListener('mousemove', moveMinecraftTooltip);
                        slot.addEventListener('mouseleave', hideMinecraftTooltip);
                    }
                });

                // Check if this is an add/remove/set button slot
                ['add', 'remove', 'set'].forEach(group => {
                    if (settings[group]) {
                        Object.entries(settings[group].buttons).forEach(([amount, btn]) => {
                            if (i === btn.slot) {
                                slot.classList.add('filled');
                                slot.style.cursor = 'pointer';
                                const textureUrl = getItemTexture(settings[group].material);
                                const displayName = parseMinecraftColors(btn.name);
                                slot.innerHTML = `
                                    <div class="item-icon">
                                        <img src="${textureUrl}" alt="${settings[group].material}"
                                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2250%22 y=%2250%22 font-size=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>?</text></svg>'">
                                    </div>
                                `;

                                // Add click to open modal editor
                                slot.addEventListener('click', () => {
                                    openTransactionButtonModal(type, group, amount);
                                });

                                slot.addEventListener('mouseenter', (e) => {
                                    const tooltip = document.getElementById('item-tooltip');
                                    tooltip.innerHTML = `<div class="tooltip-title">${displayName}</div>
                                        <div class="tooltip-line" style="color:#aaa;">Slot: ${i}</div>
                                        <div class="tooltip-line" style="color:#55ffff; margin-top:4px;">Click to edit</div>`;
                                    tooltip.classList.add('show');
                                    moveMinecraftTooltip(e);
                                });
                                slot.addEventListener('mousemove', moveMinecraftTooltip);
                                slot.addEventListener('mouseleave', hideMinecraftTooltip);
                            }
                        });
                    }
                });

                grid.appendChild(slot);
            }

            // Update preview title
            const titleText = settings.titlePrefix + settings.displayMaterial;
            document.getElementById('preview-title').innerHTML = parseMinecraftColors(titleText);
        }

        // ========== MODAL FUNCTIONS ==========

        function openEditModal(data) {
            currentModalData = data;
            const modal = document.getElementById('edit-modal');
            const modalTitle = document.getElementById('modal-title');
            const modalContent = document.getElementById('modal-content');
            const deleteBtn = document.getElementById('modal-delete-btn');

            modalTitle.textContent = data.title || 'Edit Item';

            // Generate content from fields array or use provided content
            if (data.fields && Array.isArray(data.fields)) {
                let html = '';
                data.fields.forEach(field => {
                    html += '<div class="form-group">';

                    if (field.type === 'checkbox') {
                        html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
                        html += `<input type="checkbox" id="${field.id}" ${field.value ? 'checked' : ''} style="cursor: pointer;">`;
                        html += `<span>${field.label}</span>`;
                        html += `</label>`;
                    } else {
                        html += `<label>${field.label}</label>`;

                        if (field.type === 'textarea') {
                            html += `<textarea id="${field.id}" placeholder="${field.placeholder || ''}" style="min-height: 100px;">${field.value || ''}</textarea>`;
                        } else if (field.type === 'number') {
                            html += `<input type="number" id="${field.id}" value="${field.value || ''}" min="${field.min || ''}" max="${field.max || ''}" placeholder="${field.placeholder || ''}">`;
                        } else {
                            html += `<input type="text" id="${field.id}" value="${field.value || ''}" placeholder="${field.placeholder || ''}">`;
                        }
                    }

                    if (field.hint) {
                        html += `<small style="color: rgba(150, 160, 180, 0.8); font-size: 0.85em; display: block; margin-top: 6px;">${field.hint}</small>`;
                    }
                    html += '</div>';
                });
                modalContent.innerHTML = html;
            } else {
                modalContent.innerHTML = data.content;
            }

            // Show/hide delete button
            if (data.onDelete) {
                deleteBtn.style.display = 'block';
            } else {
                deleteBtn.style.display = 'none';
            }

            // Prevent background scrolling
            document.body.style.overflow = 'hidden';

            modal.style.display = 'flex';

            // Add bounce-in animation to modal content (only if animations enabled)
            const modalBox = modal.querySelector('div[style*="background"]');
            const animationsDisabled = document.body.classList.contains('no-animations');

            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            } else if (modalBox) {
                modalBox.style.animation = 'none';
            }
        }

        function closeEditModal() {
            const modal = document.getElementById('edit-modal');
            const modalBox = modal.querySelector('div[style*="background"]');
            const animationsDisabled = document.body.classList.contains('no-animations');

            // Add fade-out animation (only if animations enabled)
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                    currentModalData = null;
                }, 300);
            } else {
                modal.style.display = 'none';
                currentModalData = null;
            }

            // Restore background scrolling
            document.body.style.overflow = '';
        }

        function saveEditModal() {
            if (!currentModalData || !currentModalData.onSave) {
                closeEditModal();
                return;
            }

            // If using fields array, collect data and pass to onSave
            if (currentModalData.fields && Array.isArray(currentModalData.fields)) {
                const data = {};
                currentModalData.fields.forEach(field => {
                    const element = document.getElementById(field.id);
                    if (element) {
                        if (field.type === 'checkbox') {
                            data[field.id] = element.checked;
                        } else {
                            data[field.id] = element.value;
                        }
                    }
                });
                currentModalData.onSave(data);
            } else {
                currentModalData.onSave();
            }

            closeEditModal();
        }

        function deleteFromModal() {
            if (!currentModalData || !currentModalData.onDelete) {
                return;
            }
            currentModalData.onDelete();
        }

        // Open modal for shop item
        function openShopItemModal(itemId) {
            const item = items.find(i => i.id === itemId);
            if (!item) return;

            const content = `
                <div class="form-group">
                    <label>Material</label>
                    <input type="text" id="modal-material" value="${item.material}">
                </div>
                <div class="form-group">
                    <label>Name (use & for colors)</label>
                    <input type="text" id="modal-name" value="${item.name}">
                </div>
                <div class="form-group">
                    <label>Buy Price (0 = cannot buy)</label>
                    <input type="number" step="0.01" id="modal-price" value="${item.price}">
                </div>
                <div class="form-group">
                    <label>Sell Price (0 = cannot sell)</label>
                    <input type="number" step="0.01" id="modal-sellPrice" value="${item.sellPrice || 0}">
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="modal-amount" min="1" max="64" value="${item.amount}">
                </div>
                <div class="form-group">
                    <label>Lore (one per line, use & for colors)</label>
                    <textarea id="modal-lore" rows="5" placeholder="Enter lore lines here... (empty lines are preserved for spacing)">${(item.lore || []).join('\n')}</textarea>
                    <small style="color: #888; display: block; margin-top: 4px;">Currently has ${(item.lore || []).length} line(s)</small>
                </div>
                <div class="form-group">
                    <label>Enchantments (format: ENCHANTMENT:LEVEL, one per line)</label>
                    <textarea id="modal-enchantments" rows="3" placeholder="e.g., SHARPNESS:5&#10;UNBREAKING:3">${Object.entries(item.enchantments || {}).map(([k, v]) => `${k}:${v}`).join('\n')}</textarea>
                    <small style="color: #888; display: block; margin-top: 4px;">Examples: SHARPNESS:5, UNBREAKING:3, PROTECTION:4, EFFICIENCY:5, FORTUNE:3, LOOTING:3, MENDING:1, INFINITY:1</small>
                </div>
                <div id="modal-type-specific-fields"></div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-hideAttributes" ${item.hideAttributes ? 'checked' : ''}>
                        Hide Attributes
                    </label>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-hideAdditional" ${item.hideAdditional ? 'checked' : ''}>
                        Hide Additional Info
                    </label>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-requireName" ${item.requireName ? 'checked' : ''}>
                        Require Name (item must have this name to sell, and will include name when bought)
                    </label>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-requireLore" ${item.requireLore ? 'checked' : ''}>
                        Require Lore (item must have this lore to sell, and will include lore when bought)
                    </label>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-unstableTnt" ${item.unstableTnt ? 'checked' : ''}>
                        Unstable TNT (spawns TNT entities with 0 fuse instead of giving TNT items)
                    </label>
                </div>
            `;

            openEditModal({
                title: `Edit Shop Item #${item.id + 1}`,
                content,
                onSave: () => {
                    // Capture before state
                    const beforeData = JSON.parse(JSON.stringify(item));

                    updateItem(item.id, 'material', document.getElementById('modal-material').value);
                    updateItem(item.id, 'name', document.getElementById('modal-name').value);
                    updateItem(item.id, 'price', parseFloat(document.getElementById('modal-price').value) || 0);
                    updateItem(item.id, 'sellPrice', parseFloat(document.getElementById('modal-sellPrice').value) || 0);
                    updateItem(item.id, 'amount', parseInt(document.getElementById('modal-amount').value) || 1);
                    updateItem(item.id, 'lore', document.getElementById('modal-lore').value.split('\n'));

                    // Parse enchantments
                    const enchText = document.getElementById('modal-enchantments').value;
                    const enchantments = {};
                    if (enchText.trim()) {
                        enchText.split('\n').forEach(line => {
                            const parts = line.trim().split(':');
                            if (parts.length === 2) {
                                const enchName = parts[0].trim().toUpperCase();
                                const level = parseInt(parts[1].trim());
                                if (enchName && !isNaN(level)) {
                                    enchantments[enchName] = level;
                                }
                            }
                        });
                    }
                    updateItem(item.id, 'enchantments', enchantments);

                    // Get the current material value (may have changed)
                    const currentMaterial = document.getElementById('modal-material').value.toUpperCase();

                    if (currentMaterial === 'SPAWNER' || currentMaterial === 'TRIAL_SPAWNER') {
                        const spawnerTypeInput = document.getElementById('modal-spawnerType');
                        if (spawnerTypeInput) {
                            updateItem(item.id, 'spawnerType', spawnerTypeInput.value);
                        }
                    }
                    if (currentMaterial === 'POTION' || currentMaterial === 'SPLASH_POTION' || currentMaterial === 'LINGERING_POTION' || currentMaterial === 'TIPPED_ARROW') {
                        const potionTypeInput = document.getElementById('modal-potionType');
                        if (potionTypeInput) {
                            updateItem(item.id, 'potionType', potionTypeInput.value);
                        }
                        const potionLevelInput = document.getElementById('modal-potionLevel');
                        if (potionLevelInput) {
                            updateItem(item.id, 'potionLevel', parseInt(potionLevelInput.value) || 0);
                        }
                    }
                    updateItem(item.id, 'hideAttributes', document.getElementById('modal-hideAttributes').checked);
                    updateItem(item.id, 'hideAdditional', document.getElementById('modal-hideAdditional').checked);
                    updateItem(item.id, 'requireName', document.getElementById('modal-requireName').checked);
                    updateItem(item.id, 'requireLore', document.getElementById('modal-requireLore').checked);
                    updateItem(item.id, 'unstableTnt', document.getElementById('modal-unstableTnt').checked);

                    // Log the update
                    const afterData = JSON.parse(JSON.stringify(item));
                    addActivityEntry('updated', 'shop-item', beforeData, afterData, { shopFile: currentShopFile });
                },
                onDelete: async () => {
                    const confirmed = await showConfirm('Delete this item?');
                    if (confirmed) {
                        removeItem(item.id);
                        closeEditModal();
                    }
                }
            });

            // After modal opens, set up dynamic type-specific fields
            setTimeout(() => {
                const materialInput = document.getElementById('modal-material');
                const typeFieldsContainer = document.getElementById('modal-type-specific-fields');

                function updateTypeSpecificFields() {
                    const material = materialInput.value.toUpperCase();
                    let fieldsHTML = '';

                    // Spawner fields
                    if (material === 'SPAWNER') {
                        fieldsHTML = `
                            <div class="form-group">
                                <label>Spawner Type</label>
                                <input type="text" id="modal-spawnerType" value="${item.spawnerType || 'PIG'}" placeholder="e.g., PIG, ZOMBIE, CREEPER">
                            </div>
                        `;
                    }
                    // Trial spawner fields
                    else if (material === 'TRIAL_SPAWNER') {
                        fieldsHTML = `
                            <div class="form-group">
                                <label>Trial Spawner Type</label>
                                <input type="text" id="modal-spawnerType" value="${item.spawnerType || 'ZOMBIE'}" placeholder="e.g., ZOMBIE, SKELETON, SPIDER">
                            </div>
                        `;
                    }
                    // Potion fields
                    else if (material === 'POTION' || material === 'SPLASH_POTION' || material === 'LINGERING_POTION' || material === 'TIPPED_ARROW') {
                        fieldsHTML = `
                            <div class="form-group">
                                <label>Potion Type</label>
                                <input type="text" id="modal-potionType" value="${item.potionType || 'SPEED'}" placeholder="e.g., SPEED, STRENGTH, INVISIBILITY">
                                <small style="color: #888; display: block; margin-top: 4px;">Examples: SPEED, STRENGTH, REGENERATION, FIRE_RESISTANCE, WATER_BREATHING, INVISIBILITY, NIGHT_VISION, WEAKNESS, POISON, SLOWNESS, HARMING, HEALING, LUCK</small>
                            </div>
                            <div class="form-group">
                                <label>Potion Level (0 = default, 1-255 = custom level)</label>
                                <input type="number" id="modal-potionLevel" value="${item.potionLevel || 0}" min="0" max="255" placeholder="0">
                                <small style="color: #888; display: block; margin-top: 4px;">0 uses Minecraft's default level. 1-255 creates custom amplified effects (e.g., level 5 = Speed V)</small>
                            </div>
                        `;
                    }

                    typeFieldsContainer.innerHTML = fieldsHTML;
                }

                // Update fields on load
                updateTypeSpecificFields();

                // Update fields when material changes
                materialInput.addEventListener('input', updateTypeSpecificFields);
            }, 50);
        }

        // Open modal for main menu shop
        function openMainMenuShopModal(index) {
            const shop = loadedGuiShops[index];
            if (!shop) return;

            console.log('Opening main menu shop modal for:', shop.key, 'with lore:', shop.lore);
            console.log('Lore array length:', (shop.lore || []).length);
            console.log('Lore joined:', JSON.stringify((shop.lore || []).join('\n')));
            console.log('Full shop object:', JSON.stringify(shop, null, 2));

            const content = `
                <div class="form-group">
                    <label>Button Key (YAML identifier)</label>
                    <input type="text" id="modal-key" value="${shop.key}" placeholder="e.g., info_button">
                    <small style="color: #888; display: block; margin-top: 4px;">No spaces allowed - will auto-convert to underscores</small>
                </div>
                <div class="form-group">
                    <label>Slot (0-53)</label>
                    <input type="number" id="modal-slot" min="0" max="53" value="${shop.slot}">
                </div>
                <div class="form-group">
                    <label>Icon Material</label>
                    <input type="text" id="modal-material" value="${shop.material}">
                </div>
                <div class="form-group">
                    <label>Display Name (use & for colors)</label>
                    <input type="text" id="modal-name" value="${shop.name}">
                    <small style="color: #888; display: block; margin-top: 4px;">This is what players see in-game</small>
                </div>
                <div class="form-group">
                    <label>Lore (one per line, use %available-times% for availability)</label>
                    <textarea id="modal-lore" rows="5" placeholder="Enter lore lines here... (empty lines are preserved for spacing)">${(shop.lore || []).join('\n')}</textarea>
                    <small style="color: #888; display: block; margin-top: 4px;">Currently has ${(shop.lore || []).length} line(s)</small>
                </div>
                <div class="form-group">
                    <label>Shop Key (File)</label>
                    <select id="modal-shopKey">
                        <option value="" ${shop.shopKey === '' ? 'selected' : ''}>-- No Action --</option>
                        ${Object.keys(allShops).map(filename => {
                            const shopKey = filename.replace('.yml', '');
                            return `<option value="${shopKey}" ${shop.shopKey === shopKey ? 'selected' : ''}>${shopKey}</option>`;
                        }).join('')}
                    </select>
                    <small style="color: #888; display: block; margin-top: 4px;">Which shop file to open (or No Action)</small>
                </div>
                <div class="form-group">
                    <label>Permission (optional)</label>
                    <input type="text" id="modal-permission" value="${shop.permission || ''}">
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-hideAttributes" ${shop.hideAttributes ? 'checked' : ''}>
                        Hide Attributes
                    </label>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="modal-hideAdditional" ${shop.hideAdditional ? 'checked' : ''}>
                        Hide Additional Info
                    </label>
                </div>
            `;

            openEditModal({
                title: `Edit Main Menu: ${shop.name || shop.key}`,
                content,
                onSave: () => {
                    const newSlot = parseInt(document.getElementById('modal-slot').value);

                    // Check for slot conflicts (exclude current button being edited)
                    const slotCheck = isMainMenuSlotOccupied(newSlot, index);
                    if (slotCheck.occupied) {
                        showAlert(`Slot ${newSlot} is already occupied by "${slotCheck.location}". Please choose a different slot.`, 'warning');
                        return;
                    }

                    // Capture before state
                    const beforeData = JSON.parse(JSON.stringify(shop));

                    updateMainMenuShop(index, 'key', document.getElementById('modal-key').value.replace(/[^a-zA-Z0-9_-]/g, '_'));
                    updateMainMenuShop(index, 'slot', newSlot);
                    updateMainMenuShop(index, 'material', document.getElementById('modal-material').value);
                    updateMainMenuShop(index, 'name', document.getElementById('modal-name').value);
                    updateMainMenuShop(index, 'lore', document.getElementById('modal-lore').value.split('\n'));
                    updateMainMenuShop(index, 'shopKey', document.getElementById('modal-shopKey').value);
                    updateMainMenuShop(index, 'permission', document.getElementById('modal-permission').value);
                    updateMainMenuShop(index, 'hideAttributes', document.getElementById('modal-hideAttributes').checked);
                    updateMainMenuShop(index, 'hideAdditional', document.getElementById('modal-hideAdditional').checked);

                    // Log the update
                    const afterData = JSON.parse(JSON.stringify(shop));
                    addActivityEntry('updated', 'main-menu-button', beforeData, afterData);
                },
                onDelete: async () => {
                    const confirmed = await showConfirm('Delete this shop button?');
                    if (confirmed) {
                        await removeMainMenuShop(index);
                        closeEditModal();
                    }
                }
            });
        }

        // Open modal for transaction button
        function openTransactionButtonModal(type, group, key) {
            if (group === 'main') {
                const btn = transactionSettings[type].buttons[key];
                if (!btn) return;

                const content = `
                    <div class="form-group">
                        <label>Material</label>
                        <input type="text" id="modal-material" value="${btn.material}">
                    </div>
                    <div class="form-group">
                        <label>Name (use & for colors)</label>
                        <input type="text" id="modal-name" value="${btn.name}">
                    </div>
                    <div class="form-group">
                        <label>Slot (0-53)</label>
                        <input type="number" id="modal-slot" min="0" max="53" value="${btn.slot}">
                    </div>
                `;

                openEditModal({
                    title: `Edit ${type.toUpperCase()}: ${key.toUpperCase()}`,
                    content,
                    onSave: () => {
                        if (type === 'purchase') {
                            updatePurchaseButton(key, 'material', document.getElementById('modal-material').value);
                            updatePurchaseButton(key, 'name', document.getElementById('modal-name').value);
                            updatePurchaseButton(key, 'slot', parseInt(document.getElementById('modal-slot').value));
                        } else {
                            updateSellButton(key, 'material', document.getElementById('modal-material').value);
                            updateSellButton(key, 'name', document.getElementById('modal-name').value);
                            updateSellButton(key, 'slot', parseInt(document.getElementById('modal-slot').value));
                        }
                    }
                });
            } else {
                // Add/Remove/Set button
                const btn = transactionSettings[type][group].buttons[key];
                if (!btn) return;

                const content = `
                    <div class="form-group">
                        <label>Amount/Value</label>
                        <input type="text" id="modal-amount" value="${key}">
                    </div>
                    <div class="form-group">
                        <label>Name (use & for colors)</label>
                        <input type="text" id="modal-name" value="${btn.name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Slot (0-53)</label>
                        <input type="number" id="modal-slot" min="0" max="53" value="${btn.slot || 0}">
                    </div>
                `;

                openEditModal({
                    title: `Edit ${type.toUpperCase()}: ${group.toUpperCase()} ${key}`,
                    content,
                    onSave: () => {
                        const newAmount = document.getElementById('modal-amount').value;
                        const newName = document.getElementById('modal-name').value;
                        const newSlot = parseInt(document.getElementById('modal-slot').value);

                        // Check for slot conflicts (exclude current button being edited)
                        const slotCheck = isSlotOccupied(type, newSlot, group, key);
                        if (slotCheck.occupied) {
                            showAlert(`Slot ${newSlot} is already occupied by ${slotCheck.location}. Please choose a different slot.`, 'warning');
                            return;
                        }

                        // Log before changes
                        const beforeData = JSON.parse(JSON.stringify({
                            type: type,
                            group: group,
                            amount: key,
                            ...transactionSettings[type][group].buttons[key]
                        }));

                        if (newAmount !== key) {
                            // If amount changed, we need to delete old key and create new one
                            const btn = transactionSettings[type][group].buttons[key];
                            delete transactionSettings[type][group].buttons[key];
                            transactionSettings[type][group].buttons[newAmount] = {
                                name: newName,
                                slot: newSlot
                            };
                        } else {
                            updateGroupButton(type, group, key, 'name', newName);
                            updateGroupButton(type, group, key, 'slot', newSlot);
                        }

                        // Log after changes
                        const afterData = JSON.parse(JSON.stringify({
                            type: type,
                            group: group,
                            amount: newAmount,
                            ...transactionSettings[type][group].buttons[newAmount]
                        }));
                        addActivityEntry('updated', `${type}-menu-button`, beforeData, afterData);

                        if (type === 'purchase') {
                            renderPurchaseButtons();
                            updatePurchasePreview();
                        } else {
                            renderSellButtons();
                            updateSellPreview();
                        }
                        if (!isLoadingFiles) {
                            if (type === 'purchase') {
                                savePurchaseMenuYaml();
                            } else {
                                saveSellMenuYaml();
                            }
                        }
                        closeEditModal();
                    },
                    onDelete: async () => {
                        const confirmed = await showConfirm('Delete this button?');
                        if (confirmed) {
                            // Log before deletion
                            const beforeData = JSON.parse(JSON.stringify({
                                type: type,
                                group: group,
                                amount: key,
                                ...transactionSettings[type][group].buttons[key]
                            }));
                            addActivityEntry('deleted', `${type}-menu-button`, beforeData, null);

                            delete transactionSettings[type][group].buttons[key];
                            if (type === 'purchase') {
                                renderPurchaseButtons();
                                updatePurchasePreview();
                            } else {
                                renderSellButtons();
                                updateSellPreview();
                            }
                            if (!isLoadingFiles) {
                                if (type === 'purchase') {
                                    savePurchaseMenuYaml();
                                } else {
                                    saveSellMenuYaml();
                                }
                            }
                            closeEditModal();
                        }
                    }
                });
            }
        }

        // Create debounced versions of preview update functions
        const debouncedUpdatePreview = debounce(updatePreview, 150);
        const debouncedUpdateGuiPreview = debounce(updateGuiPreview, 150);
        const debouncedUpdatePurchasePreview = debounce(updatePurchasePreview, 150);
        const debouncedUpdateSellPreview = debounce(updateSellPreview, 150);

        // Performance: Use passive event listeners where possible
        document.addEventListener('DOMContentLoaded', () => {
            // Enable GPU acceleration for smooth animations
            const previewPanel = document.querySelector('.preview-panel');
            const editorPanel = document.querySelector('.editor-panel');

            if (previewPanel) {
                previewPanel.style.transform = 'translateZ(0)';
                previewPanel.style.willChange = 'scroll-position';
            }

            if (editorPanel) {
                editorPanel.style.transform = 'translateZ(0)';
                editorPanel.style.willChange = 'scroll-position';
            }
        });

        // ===== ACTIVITY LOG FUNCTIONS =====

        function openActivityLogModal() {
            const modal = document.getElementById('activity-log-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            refreshActivityLog();
            modal.style.display = 'flex';

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            } else if (modalBox) {
                modalBox.style.animation = 'none';
            }
        }

        function closeActivityLogModal() {
            const modal = document.getElementById('activity-log-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            } else {
                modal.style.display = 'none';
            }
        }

        function refreshActivityLog() {
            const container = document.getElementById('activity-log-container');
            const emptyMessage = document.getElementById('activity-log-empty');

            if (activityLog.length === 0) {
                container.style.display = 'none';
                emptyMessage.style.display = 'block';
                return;
            }

            container.style.display = 'flex';
            emptyMessage.style.display = 'none';
            container.innerHTML = '';

            activityLog.forEach(entry => {
                const entryEl = createActivityEntry(entry);
                container.appendChild(entryEl);
            });
        }

        function createActivityEntry(entry) {
            const div = document.createElement('div');
            div.className = 'activity-entry';

            const actionIcon = {
                'created': '➕',
                'updated': '✏️',
                'deleted': '🗑️'
            }[entry.action] || '📝';

            const targetLabel = {
                'shop-item': 'Shop Item',
                'main-menu-button': 'Main Menu Button',
                'purchase-menu': 'Purchase Menu',
                'sell-menu': 'Sell Menu',
                'shop-file': 'Shop File',
                'shop-settings': 'Shop Settings',
                'mainmenu-settings': 'Main Menu Settings'
            }[entry.target] || 'Unknown';

            const date = new Date(entry.timestamp);
            const timeAgo = getTimeAgo(date);
            const formattedDate = date.toLocaleString();

            div.innerHTML = `
                <div style="background: linear-gradient(135deg, rgba(120, 119, 198, 0.1), rgba(0, 184, 217, 0.1)); border: 1px solid rgba(120, 119, 198, 0.25); border-radius: 12px; padding: 16px 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;"
                     onmouseover="this.style.borderColor='rgba(120, 119, 198, 0.5)'; this.style.transform='translateX(4px)'; this.style.background='linear-gradient(135deg, rgba(120, 119, 198, 0.15), rgba(0, 184, 217, 0.15))';"
                     onmouseout="this.style.borderColor='rgba(120, 119, 198, 0.25)'; this.style.transform='translateX(0)'; this.style.background='linear-gradient(135deg, rgba(120, 119, 198, 0.1), rgba(0, 184, 217, 0.1))';"
                     onclick="viewActivityDetails('${entry.id}')">

                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${entry.action === 'created' ? 'linear-gradient(180deg, #00e676, #00c853)' : entry.action === 'updated' ? 'linear-gradient(180deg, #ffd600, #ffab00)' : 'linear-gradient(180deg, #ff6b6b, #d32f2f)'};"></div>

                    <div style="display: flex; align-items: start; gap: 14px; margin-left: 8px;">
                        <div style="font-size: 1.8em; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${actionIcon}</div>

                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                                <span style="font-weight: 700; font-size: 0.95em; color: rgba(220, 230, 245, 0.95);">${entry.username}</span>
                                <span style="color: rgba(180, 190, 210, 0.7); font-size: 0.85em;">${entry.action}</span>
                                <span style="background: rgba(120, 119, 198, 0.2); border: 1px solid rgba(120, 119, 198, 0.3); padding: 3px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 600; color: rgba(200, 210, 225, 0.9);">${targetLabel}</span>
                            </div>

                            <div style="color: rgba(180, 190, 210, 0.8); font-size: 0.9em; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${getActivitySummary(entry)}
                            </div>

                            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8em; color: rgba(160, 170, 190, 0.7);">
                                <span>🕐</span>
                                <span title="${formattedDate}">${timeAgo}</span>
                            </div>
                        </div>

                        <div style="color: rgba(120, 119, 198, 0.5); font-size: 1.2em; flex-shrink: 0;">›</div>
                    </div>
                </div>
            `;

            return div;
        }

        function getActivitySummary(entry) {
            if (entry.action === 'created') {
                if (entry.target === 'shop-item') {
                    return `Created item: ${entry.afterData?.name || 'Unnamed Item'}`;
                } else if (entry.target === 'main-menu-button') {
                    return `Added button: ${entry.afterData?.name || 'Unnamed Button'}`;
                } else if (entry.target === 'shop-file') {
                    return `Created shop file: ${entry.details?.filename || 'Unknown'}`;
                } else if (entry.target === 'purchase-menu-button' || entry.target === 'sell-menu-button') {
                    const menuType = entry.target === 'purchase-menu-button' ? 'Purchase' : 'Sell';
                    return `Added ${menuType} ${entry.afterData?.group?.toUpperCase()} button: ${entry.afterData?.amount}`;
                }
            } else if (entry.action === 'updated') {
                if (entry.target === 'shop-item' || entry.target === 'main-menu-button') {
                    const changes = [];
                    if (entry.beforeData?.name !== entry.afterData?.name) {
                        changes.push('name');
                    }
                    if (entry.beforeData?.material !== entry.afterData?.material) {
                        changes.push('material');
                    }
                    if (entry.beforeData?.price !== entry.afterData?.price) {
                        changes.push('price');
                    }
                    if (JSON.stringify(entry.beforeData?.lore) !== JSON.stringify(entry.afterData?.lore)) {
                        changes.push('lore');
                    }
                    return `Updated ${entry.afterData?.name || 'item'}: ${changes.join(', ') || 'properties changed'}`;
                } else if (entry.target === 'purchase-menu-button' || entry.target === 'sell-menu-button') {
                    const menuType = entry.target === 'purchase-menu-button' ? 'Purchase' : 'Sell';
                    return `Updated ${menuType} ${entry.afterData?.group?.toUpperCase()} button: ${entry.afterData?.amount}`;
                } else if (entry.target === 'purchase-menu' || entry.target === 'sell-menu') {
                    const menuType = entry.target === 'purchase-menu' ? 'Purchase' : 'Sell';
                    return `Modified ${menuType} Menu configuration`;
                } else if (entry.target === 'shop-settings') {
                    return `Updated shop settings for ${entry.details?.shopFile || 'shop'}`;
                } else if (entry.target === 'mainmenu-settings') {
                    return `Updated main menu settings`;
                }
            } else if (entry.action === 'deleted') {
                if (entry.target === 'shop-item' || entry.target === 'main-menu-button') {
                    return `Deleted: ${entry.beforeData?.name || 'Unnamed Item'}`;
                } else if (entry.target === 'shop-file') {
                    return `Deleted shop file: ${entry.details?.filename || 'Unknown'}`;
                } else if (entry.target === 'purchase-menu-button' || entry.target === 'sell-menu-button') {
                    const menuType = entry.target === 'purchase-menu-button' ? 'Purchase' : 'Sell';
                    return `Deleted ${menuType} ${entry.beforeData?.group?.toUpperCase()} button: ${entry.beforeData?.amount}`;
                }
            }
            return 'Made changes';
        }

        function getTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);

            if (seconds < 60) return 'Just now';

            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;

            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;

            const days = Math.floor(hours / 24);
            if (days < 7) return `${days}d ago`;

            const weeks = Math.floor(days / 7);
            if (weeks < 4) return `${weeks}w ago`;

            const months = Math.floor(days / 30);
            return `${months}mo ago`;
        }

        function viewActivityDetails(entryId) {
            const entry = activityLog.find(e => e.id == entryId);
            if (!entry) return;

            const modal = document.getElementById('activity-detail-modal');
            const title = document.getElementById('activity-detail-title');
            const content = document.getElementById('activity-detail-content');

            const actionText = {
                'created': 'Created',
                'updated': 'Updated',
                'deleted': 'Deleted'
            }[entry.action] || 'Changed';

            const targetLabel = {
                'shop-item': 'Shop Item',
                'main-menu-button': 'Main Menu Button',
                'purchase-menu': 'Purchase Menu',
                'sell-menu': 'Sell Menu',
                'shop-file': 'Shop File',
                'shop-settings': 'Shop Settings',
                'mainmenu-settings': 'Main Menu Settings'
            }[entry.target] || 'Unknown';

            title.textContent = `${actionText} ${targetLabel}`;

            // Store current entry for rollback
            currentViewedEntry = entry;

            // Show/hide rollback button based on action type
            const rollbackBtn = document.getElementById('rollback-btn');
            // Show rollback for updates and deletions (except shop-file deletions which can't be restored)
            if ((entry.action === 'updated' || entry.action === 'deleted') &&
                !(entry.action === 'deleted' && entry.target === 'shop-file')) {
                rollbackBtn.style.display = 'flex';
            } else {
                rollbackBtn.style.display = 'none';
            }

            content.innerHTML = `
                <div style="background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(120, 119, 198, 0.2);">
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 12px 16px; font-size: 0.9em;">
                        <div style="color: rgba(180, 190, 210, 0.7); font-weight: 600;">User:</div>
                        <div style="color: rgba(220, 230, 245, 0.95);">${entry.username}</div>

                        <div style="color: rgba(180, 190, 210, 0.7); font-weight: 600;">Time:</div>
                        <div style="color: rgba(220, 230, 245, 0.95);">${new Date(entry.timestamp).toLocaleString()}</div>

                        <div style="color: rgba(180, 190, 210, 0.7); font-weight: 600;">Action:</div>
                        <div style="color: rgba(220, 230, 245, 0.95);">${actionText} ${targetLabel}</div>
                    </div>
                </div>

                ${entry.action === 'deleted' ? `
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <span style="font-size: 1.2em;">🗑️</span>
                            <h3 style="margin: 0; color: rgba(255, 107, 107, 0.9); font-size: 1em; font-weight: 700;">DELETED DATA</h3>
                        </div>
                        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 10px; padding: 14px;">
                            <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${JSON.stringify(entry.beforeData, null, 2)}</pre>
                        </div>
                    </div>
                ` : entry.action === 'created' ? `
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <span style="font-size: 1.2em;">➕</span>
                            <h3 style="margin: 0; color: rgba(0, 230, 118, 0.9); font-size: 1em; font-weight: 700;">CREATED DATA</h3>
                        </div>
                        <div style="background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 10px; padding: 14px;">
                            <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${JSON.stringify(entry.afterData, null, 2)}</pre>
                        </div>
                    </div>
                ` : `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <span style="font-size: 1.2em;">📋</span>
                                <h3 style="margin: 0; color: rgba(255, 107, 107, 0.9); font-size: 1em; font-weight: 700;">BEFORE</h3>
                            </div>
                            <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 10px; padding: 14px; height: 400px; overflow-y: auto;">
                                <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${JSON.stringify(entry.beforeData, null, 2)}</pre>
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <span style="font-size: 1.2em;">📋</span>
                                <h3 style="margin: 0; color: rgba(0, 230, 118, 0.9); font-size: 1em; font-weight: 700;">AFTER</h3>
                            </div>
                            <div style="background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 10px; padding: 14px; height: 400px; overflow-y: auto;">
                                <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${JSON.stringify(entry.afterData, null, 2)}</pre>
                            </div>
                        </div>
                    </div>

                    <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 10px; padding: 14px;">
                        <div style="font-weight: 700; margin-bottom: 8px; color: rgba(255, 215, 0, 0.9); font-size: 0.9em;">📊 CHANGES DETECTED</div>
                        ${generateChangeSummary(entry.beforeData, entry.afterData)}
                    </div>
                `}
            `;

            const animationsDisabled = document.body.classList.contains('no-animations');
            modal.style.display = 'flex';

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            } else if (modalBox) {
                modalBox.style.animation = 'none';
            }
        }

        function generateChangeSummary(before, after) {
            const changes = [];
            const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

            allKeys.forEach(key => {
                const beforeVal = before?.[key];
                const afterVal = after?.[key];

                if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                    changes.push(`
                        <div style="padding: 8px 0; border-bottom: 1px solid rgba(255, 215, 0, 0.2); display: grid; grid-template-columns: auto 1fr 1fr; gap: 12px; align-items: start;">
                            <div style="font-weight: 600; color: rgba(220, 230, 245, 0.95); min-width: 80px;">${key}:</div>
                            <div style="color: rgba(255, 107, 107, 0.8); font-size: 0.85em; word-break: break-word;">
                                <span style="text-decoration: line-through; opacity: 0.7;">${JSON.stringify(beforeVal)}</span>
                            </div>
                            <div style="color: rgba(0, 230, 118, 0.9); font-size: 0.85em; word-break: break-word;">
                                ${JSON.stringify(afterVal)}
                            </div>
                        </div>
                    `);
                }
            });

            return changes.length > 0 ? changes.join('') : '<div style="color: rgba(180, 190, 210, 0.7); font-size: 0.9em;">No property changes detected</div>';
        }

        function closeActivityDetailModal() {
            const modal = document.getElementById('activity-detail-modal');
            const animationsDisabled = document.body.classList.contains('no-animations');

            const modalBox = modal.querySelector('div[style*="background"]');
            if (modalBox && !animationsDisabled) {
                modalBox.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            } else {
                modal.style.display = 'none';
            }
        }

        async function clearActivityLog() {
            const confirmed = await showConfirm('Are you sure you want to clear all activity logs? This cannot be undone.');
            if (!confirmed) {
                return;
            }

            activityLog = [];
            saveActivityLog();
            refreshActivityLog();
        }

        async function rollbackChange() {
            if (!currentViewedEntry) return;

            const entry = currentViewedEntry;
            const confirmMsg = entry.action === 'deleted'
                ? `Restore this ${entry.target.replace('-', ' ')}?\n\nThis will recreate the item as it was before deletion.`
                : `Rollback this change?\n\nThis will restore the ${entry.target.replace('-', ' ')} to its previous state.`;

            const confirmed = await showConfirm(confirmMsg);
            if (!confirmed) return;

            try {
                if (entry.target === 'shop-item') {
                    rollbackShopItem(entry);
                } else if (entry.target === 'main-menu-button') {
                    rollbackMainMenuButton(entry);
                } else if (entry.target === 'shop-settings') {
                    rollbackShopSettings(entry);
                } else if (entry.target === 'mainmenu-settings') {
                    rollbackMainMenuSettings(entry);
                } else if (entry.target === 'purchase-menu') {
                    rollbackPurchaseMenu(entry);
                } else if (entry.target === 'sell-menu') {
                    rollbackSellMenu(entry);
                } else if (entry.target === 'shop-file') {
                    showAlert('Shop file rollback (restoration) is not supported.\n\nYou can manually recreate the shop file if needed.', 'info');
                    return;
                } else {
                    showAlert('Rollback not supported for this item type.', 'warning');
                    return;
                }

                showAlert('✓ Rollback successful!', 'success');
                closeActivityDetailModal();
                closeActivityLogModal();
            } catch (error) {
                console.error('Rollback failed:', error);
                showAlert('Failed to rollback: ' + error.message);
            }
        }

        function rollbackShopItem(entry) {
            if (entry.action === 'deleted') {
                // Restore deleted item
                const restoredItem = JSON.parse(JSON.stringify(entry.beforeData));
                restoredItem.id = itemIdCounter++;
                items.push(restoredItem);

                addActivityEntry('created', 'shop-item', null, restoredItem, {
                    shopFile: currentShopFile,
                    reason: 'Rollback from deletion'
                });
            } else if (entry.action === 'updated') {
                // Find and restore to previous state
                const item = items.find(i => i.name === entry.afterData.name || i.id === entry.afterData.id);
                if (item) {
                    const beforeRollback = JSON.parse(JSON.stringify(item));
                    Object.assign(item, entry.beforeData);
                    item.id = beforeRollback.id; // Preserve current ID

                    addActivityEntry('updated', 'shop-item', beforeRollback, item, {
                        shopFile: currentShopFile,
                        reason: 'Rollback to previous version'
                    });
                } else {
                    throw new Error('Item not found in current shop');
                }
            }

            renderItems();
            updateAll();
        }

        function rollbackMainMenuButton(entry) {
            if (entry.action === 'deleted') {
                // Restore deleted button
                const restoredButton = JSON.parse(JSON.stringify(entry.beforeData));
                loadedGuiShops.push(restoredButton);

                addActivityEntry('created', 'main-menu-button', null, restoredButton, {
                    reason: 'Rollback from deletion'
                });
            } else if (entry.action === 'updated') {
                // Find and restore to previous state
                const button = loadedGuiShops.find(b => b.key === entry.afterData.key);
                if (button) {
                    const beforeRollback = JSON.parse(JSON.stringify(button));
                    Object.assign(button, entry.beforeData);

                    addActivityEntry('updated', 'main-menu-button', beforeRollback, button, {
                        reason: 'Rollback to previous version'
                    });
                } else {
                    throw new Error('Button not found in main menu');
                }
            }

            renderMainMenuShops();
            updateGuiPreview();
            saveMainMenuYaml();
        }

        function rollbackShopSettings(entry) {
            if (entry.action !== 'updated') return;

            const beforeRollback = {
                guiName: document.getElementById('gui-name').value,
                rows: document.getElementById('rows').value,
                permission: document.getElementById('permission').value,
                availableTimes: document.getElementById('available-times').value,
                showBuyPrice: document.getElementById('shop-show-buy-price').checked,
                buyPriceLine: document.getElementById('shop-buy-price-line').value,
                showBuyHint: document.getElementById('shop-show-buy-hint').checked,
                buyHintLine: document.getElementById('shop-buy-hint-line').value,
                showSellPrice: document.getElementById('shop-show-sell-price').checked,
                sellPriceLine: document.getElementById('shop-sell-price-line').value,
                showSellHint: document.getElementById('shop-show-sell-hint').checked,
                sellHintLine: document.getElementById('shop-sell-hint-line').value
            };

            // Restore to before state
            document.getElementById('gui-name').value = entry.beforeData.guiName;
            document.getElementById('rows').value = entry.beforeData.rows;
            document.getElementById('permission').value = entry.beforeData.permission;
            document.getElementById('available-times').value = entry.beforeData.availableTimes;
            document.getElementById('shop-show-buy-price').checked = entry.beforeData.showBuyPrice;
            document.getElementById('shop-buy-price-line').value = entry.beforeData.buyPriceLine;
            document.getElementById('shop-show-buy-hint').checked = entry.beforeData.showBuyHint;
            document.getElementById('shop-buy-hint-line').value = entry.beforeData.buyHintLine;
            document.getElementById('shop-show-sell-price').checked = entry.beforeData.showSellPrice;
            document.getElementById('shop-sell-price-line').value = entry.beforeData.sellPriceLine;
            document.getElementById('shop-show-sell-hint').checked = entry.beforeData.showSellHint;
            document.getElementById('shop-sell-hint-line').value = entry.beforeData.sellHintLine;

            addActivityEntry('updated', 'shop-settings', beforeRollback, entry.beforeData, {
                shopFile: currentShopFile,
                reason: 'Rollback to previous settings'
            });

            updateAll();
        }

        function rollbackMainMenuSettings(entry) {
            if (entry.action !== 'updated') return;

            const beforeRollback = {
                title: document.getElementById('mainmenu-title').value,
                rows: document.getElementById('mainmenu-rows').value
            };

            // Restore to before state
            document.getElementById('mainmenu-title').value = entry.beforeData.title;
            document.getElementById('mainmenu-rows').value = entry.beforeData.rows;

            addActivityEntry('updated', 'mainmenu-settings', beforeRollback, entry.beforeData, {
                reason: 'Rollback to previous settings'
            });

            updateMainMenuConfig();
        }

        function rollbackPurchaseMenu(entry) {
            if (entry.action !== 'updated') return;

            const beforeRollback = {
                maxAmount: document.getElementById('purchase-max-amount').value,
                titlePrefix: document.getElementById('purchase-title-prefix').value,
                addMaterial: transactionSettings.purchase.add.material,
                removeMaterial: transactionSettings.purchase.remove.material,
                setMaterial: transactionSettings.purchase.set.material
            };

            // Restore to before state
            document.getElementById('purchase-title-prefix').value = entry.beforeData.titlePrefix;
            document.getElementById('purchase-max-amount').value = entry.beforeData.maxAmount;
            transactionSettings.purchase.add.material = entry.beforeData.addMaterial;
            transactionSettings.purchase.remove.material = entry.beforeData.removeMaterial;
            transactionSettings.purchase.set.material = entry.beforeData.setMaterial;

            addActivityEntry('updated', 'purchase-menu', beforeRollback, entry.beforeData, {
                reason: 'Rollback to previous settings'
            });

            updatePurchaseSettings();
            updatePurchasePreview();
        }

        function rollbackSellMenu(entry) {
            if (entry.action !== 'updated') return;

            const beforeRollback = {
                maxAmount: document.getElementById('sell-max-amount').value,
                titlePrefix: document.getElementById('sell-title-prefix').value,
                addMaterial: transactionSettings.sell.add.material,
                removeMaterial: transactionSettings.sell.remove.material,
                setMaterial: transactionSettings.sell.set.material
            };

            // Restore to before state
            document.getElementById('sell-title-prefix').value = entry.beforeData.titlePrefix;
            document.getElementById('sell-max-amount').value = entry.beforeData.maxAmount;
            transactionSettings.sell.add.material = entry.beforeData.addMaterial;
            transactionSettings.sell.remove.material = entry.beforeData.removeMaterial;
            transactionSettings.sell.set.material = entry.beforeData.setMaterial;

            addActivityEntry('updated', 'sell-menu', beforeRollback, entry.beforeData, {
                reason: 'Rollback to previous settings'
            });

            updateSellSettings();
            updateSellPreview();
        }
