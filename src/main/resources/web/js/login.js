(function() {
    const DEFAULT_TRANSLATIONS = {
        "web-editor": {
            "modals": {
                "error-title": "Error",
                "success-title": "Success",
                "warning-title": "Warning",
                "alert-title": "Message"
            },
            "login": {
                "title": "Login - Genius Shop Editor",
                "heading": "GENIUS SHOP",
                "subtitle": "Configuration Editor",
                "requirements-title": "Requirements",
                "req1": "You must be logged into the Minecraft server",
                "req2": "You need admin permissions (geniusshop.admin or OP)",
                "req3": "Use /shop editor in-game and enter the 6-digit code",
                "tab-uuid": "UUID Login",
                "tab-code": "Code Login",
                "code-label": "Login Code",
                "code-placeholder": "6-digit code (e.g. 123456)",
                "code-hint": "Generate a code in-game using /shop editor",
                "username-label": "Minecraft Username",
                "username-placeholder": "Your in-game name",
                "password-label": "Password (Your UUID)",
                "password-placeholder": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                "password-hint": "Get your UUID from https://mcuuid.net/ or use the Code Login tab",
                "login-button": "Login",
                "security-title": "Security Confirmation Required",
                "security-text": "You are logging in from a different IP address.<br>Please check your Minecraft game and confirm the login request.",
                "waiting": "Waiting for confirmation...",
                "retry-auto": "This will retry automatically",
                "retry-in": "Retrying in",
                "confirmed": "Login Confirmed!",
                "redirecting": "Redirecting...",
                "timeout": "Confirmation timeout. Please try logging in again.",
                "failed": "Login failed"
            }
        }
    };

    let translations = DEFAULT_TRANSLATIONS;
    let currentLanguage = localStorage.getItem('preferredLanguage');

    async function loadTranslations() {
        try {
            const langParam = currentLanguage ? `?lang=${currentLanguage}` : '';
            const response = await fetch(`api/language${langParam}`);
            if (response.ok) {
                const data = await response.json();
                translations = data;
                
                if (data.language && !currentLanguage) {
                    currentLanguage = data.language;
                    localStorage.setItem('preferredLanguage', currentLanguage);
                }
                
                applyTranslations();
            }
        } catch (error) {
            console.error('Failed to load translations:', error);
        } finally {
            loadLanguages();
        }
    }

    async function loadLanguages() {
        try {
            const response = await fetch(`api/languages`);
            if (response.ok) {
                const languages = await response.json();
                const selector = document.getElementById('language-selector');
                if (selector) {
                    selector.innerHTML = '';
                    languages.forEach(lang => {
                        const option = document.createElement('option');
                        option.value = lang;
                        const names = {
                            'en_US': 'English (US)',
                            'en_GB': 'English (UK)',
                            'ru_RU': 'Russian',
                            'de_DE': 'Deutsch',
                            'fr_FR': 'French',
                            'tr_TR': 'Turkish',
                            'ro_RO': 'Romanian',
                            'es_MX': 'Spanish (MX)',
                            'es_ES': 'Spanish (ES)',
                            'es_AR': 'Spanish (AR)',
                            'pt_BR': 'Portuguese (BR)',
                            'pt_PT': 'Portuguese (PT)',
                            'vi_VN': 'Vietnamese',
                            'nl_NL': 'Nederlands',
                            'fi_FI': 'Suomi',
                            'pl_PL': 'Polski',
                            'da_DK': 'Dansk'
                        };
                        option.textContent = names[lang] || lang;
                        selector.appendChild(option);
                    });
                    if (currentLanguage) {
                        selector.value = currentLanguage;
                    }
                    initCustomSelects();
                }
            }
        } catch (error) {
            console.error('Failed to load languages list:', error);
        }
    }

    window.changeEditorLanguage = async function(lang) {
        localStorage.setItem('preferredLanguage', lang);
        currentLanguage = lang;
        await loadTranslations();
    };

    function t(key, replacements = {}) {
        if (!translations) return key;
        
        // Try full path
        let text = key.split('.').reduce((obj, k) => obj && obj[k], translations);
        
        // If not found and key starts with web-editor., try looking inside web-editor object
        if ((text === undefined || text === null) && key.startsWith('web-editor.')) {
            const subKey = key.substring('web-editor.'.length);
            text = subKey.split('.').reduce((obj, k) => obj && obj[k], translations);
        }
        
        // If still not found and translations has web-editor key, try looking there
        if ((text === undefined || text === null) && translations['web-editor']) {
            text = key.split('.').reduce((obj, k) => obj && obj[k], translations['web-editor']);
        }
        
        if (text === undefined || text === null) {
            if (typeof replacements === 'string') return replacements;
            return key;
        }
        
        if (typeof text !== 'string') return key;

        if (typeof replacements === 'object' && replacements !== null) {
            for (const [placeholder, value] of Object.entries(replacements)) {
                text = text.replace(new RegExp(`%${placeholder}%`, 'g'), value);
            }
        }
        return text;
    }

    function applyTranslations() {
        document.querySelectorAll('[data-i18n], [data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-title');
            const translated = t(key);
            if (translated !== key) {
                if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'password')) {
                    el.placeholder = translated;
                } else if (el.hasAttribute('data-i18n-title')) {
                    el.setAttribute('title', translated);
                } else {
                    el.innerHTML = translated;
                }
            }
        });
        
        // Update page title
        const pageTitle = t('web-editor.login.title');
        if (pageTitle !== 'web-editor.login.title') {
            document.title = pageTitle;
        }
    }

    // Apply defaults immediately
    applyTranslations();

    loadTranslations();

    let loginMethod = 'code';

    document.getElementById('tab-uuid').addEventListener('click', () => {
        loginMethod = 'uuid';
        document.getElementById('tab-uuid').classList.add('active');
        document.getElementById('tab-code').classList.remove('active');
        document.getElementById('uuid-fields').style.display = 'block';
        document.getElementById('code-fields').style.display = 'none';
        document.getElementById('password').required = true;
        document.getElementById('login-code').required = false;
    });

    document.getElementById('tab-code').addEventListener('click', () => {
        loginMethod = 'code';
        document.getElementById('tab-code').classList.add('active');
        document.getElementById('tab-uuid').classList.remove('active');
        document.getElementById('code-fields').style.display = 'block';
        document.getElementById('uuid-fields').style.display = 'none';
        document.getElementById('login-code').required = true;
        document.getElementById('password').required = false;
    });

    // Default to the simpler flow: in-game generated 6-digit code login.
    document.getElementById('tab-code').click();

    function escapeConfirmationHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function renderLoginConfirmationRequired(data) {
        const confirmToken = data && data.confirmToken ? String(data.confirmToken) : '';
        const command = confirmToken ? `/shop confirmlogin ${confirmToken}` : '/shop confirmlogin <token>';
        const escapedCommand = escapeConfirmationHtml(command);
        const escapedMessage = escapeConfirmationHtml((data && data.message) || 'This login request is coming from a different IP address.');

        document.body.innerHTML = `
            <div style="min-height: 100vh; background: #050505; color: #fff; font-family: Inter, sans-serif; display: grid; place-items: center; padding: 24px;">
                <div style="width: min(720px, 100%); display: flex; flex-direction: column; gap: 18px; text-align: left;">
                    <div style="font-size: 28px; font-weight: 800; color: #facc15;">${t('web-editor.login.security-title', 'Security Confirmation Required')}</div>
                    <div style="font-size: 15px; color: #d4d4d8; line-height: 1.6;">${escapedMessage}</div>
                    <div style="padding: 18px; background: rgba(250, 204, 21, 0.08); border: 1px solid rgba(250, 204, 21, 0.35); border-radius: 8px;">
                        <div style="font-size: 13px; color: #a1a1aa; margin-bottom: 10px;">Paste this command in Minecraft chat:</div>
                        <div style="display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap;">
                            <code id="confirm-login-command" style="flex: 1 1 360px; min-width: 0; padding: 12px 14px; background: #111; border: 1px solid #333; border-radius: 6px; color: #fff; overflow-wrap: anywhere;">${escapedCommand}</code>
                            <button id="copy-confirm-login-command" type="button" style="padding: 10px 16px; background: #2563eb; border: 1px solid #3b82f6; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 700;">Copy</button>
                        </div>
                    </div>
                    <div style="padding: 14px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
                        <div style="font-size: 14px; color: #d4d4d8;">${t('web-editor.login.waiting', 'Waiting for confirmation...')}</div>
                        <div style="font-size: 12px; color: #71717a; margin-top: 6px;">${t('web-editor.login.retry-auto', 'This will retry automatically')}</div>
                    </div>
                    <div id="countdown" style="font-size: 14px; color: #71717a;">${t('web-editor.login.retry-in', 'Retrying in')} <span id="timer">10</span>s</div>
                    <button onclick="window.location.href='login.html'" style="align-self: flex-start; padding: 10px 20px; background: #222; border: 1px solid #444; color: #fff; border-radius: 5px; cursor: pointer;">Go to Login Page</button>
                </div>
            </div>`;

        const copyButton = document.getElementById('copy-confirm-login-command');
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(command);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = command;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        textarea.remove();
                    }
                    copyButton.textContent = 'Copied';
                } catch (error) {
                    copyButton.textContent = 'Copy failed';
                }
            });
        }
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const code = document.getElementById('login-code').value;
        const errorEl = document.getElementById('error-message');
        const loginBtn = document.getElementById('login-btn');

        errorEl.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = '...'; 

        try {
            let response;
            if (loginMethod === 'code') {
                response = await fetch(`api/logincode`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, code })
                });
            } else {
                response = await fetch(`api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
            }

            const data = await response.json();

            if (!response.ok) {
                // Check if this is a pending confirmation (IP bypass)
                if (response.status === 403 && data.status === 'pending_confirmation') {
                    renderLoginConfirmationRequired(data);

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
                            alert(t('web-editor.login.timeout', 'Confirmation timeout. Please try logging in again.'));
                            window.location.reload();
                            return;
                        }

                        try {
                            let retryResponse;
                            if (loginMethod === 'code') {
                                retryResponse = await fetch(`api/logincode`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ username, code })
                                });
                            } else {
                                retryResponse = await fetch(`api/login`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ username, password })
                                });
                            }

                            if (retryResponse.ok) {
                                clearInterval(pollInterval);
                                clearInterval(countdownInterval);
                                const retryData = await retryResponse.json();
                                localStorage.setItem('sessionToken', retryData.sessionToken);
                                localStorage.setItem('username', retryData.username);

                                // Show success and redirect
                                document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 80px); background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px; margin: auto;"><div style="font-size: 48px;">&#10003;</div><div style="font-size: 24px; color: #4ade80;">${t('web-editor.login.confirmed', 'Login Confirmed!')}</div><div style="font-size: 14px; color: #888;">${t('web-editor.login.redirecting', 'Redirecting...')}</div></div>`;

                                setTimeout(() => {
                                    window.location.href = 'index.html';
                                }, 1500);
                            } else {
                                const retryError = await retryResponse.json();
                                // If still pending, continue polling
                                if (retryError.status !== 'pending_confirmation') {
                                    // Something else went wrong, stop polling
                                    clearInterval(pollInterval);
                                    clearInterval(countdownInterval);
                                    alert(t('web-editor.login.failed', 'Login failed') + ': ' + (retryError.error || 'Unknown error'));
                                    window.location.reload();
                                }
                            }
                        } catch (err) {
                            console.error('Poll error:', err);
                            // Continue polling on network errors
                        }
                    }, 5000); // Poll every 5 seconds

                    return;
                }

                throw new Error(data.error || t('web-editor.login.failed', 'Login failed'));
            }

            localStorage.setItem('sessionToken', data.sessionToken);
            localStorage.setItem('username', data.username);
            window.location.href = 'index.html';

        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = t('web-editor.login.login-button', 'Login');
        }
    });

        if (localStorage.getItem('sessionToken')) {
            window.location.href = 'index.html';
        }

    function initCustomSelects() {
        document.querySelectorAll('select.premium-select').forEach(select => {
            if (select.dataset.customInitialized) return;
            createCustomDropdown(select);
        });
    }

    function createCustomDropdown(select) {
        const container = document.createElement('div');
        container.className = 'custom-select';
        if (select.id) container.id = 'custom-' + select.id;
        
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        const triggerText = document.createElement('span');
        triggerText.textContent = select.options[select.selectedIndex]?.textContent || 'Select...';
        trigger.appendChild(triggerText);
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';
        
        function updateOptions() {
            optionsContainer.innerHTML = '';
            Array.from(select.options).forEach((option, index) => {
                const opt = document.createElement('div');
                opt.className = 'custom-select-option';
                if (index === select.selectedIndex) opt.classList.add('selected');
                opt.textContent = option.textContent;
                opt.onclick = (e) => {
                    e.stopPropagation();
                    select.selectedIndex = index;
                    select.dispatchEvent(new Event('change'));
                    triggerText.textContent = option.textContent;
                    container.classList.remove('open');
                    updateOptions();
                };
                optionsContainer.appendChild(opt);
            });
        }
        
        updateOptions();
        
        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('open');
            document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
            if (!isOpen) container.classList.add('open');
        };
        
        container.appendChild(trigger);
        container.appendChild(optionsContainer);
        
        select.parentNode.insertBefore(container, select);
        select.dataset.customInitialized = "true";
        
        select.addEventListener('change', () => {
            triggerText.textContent = select.options[select.selectedIndex]?.textContent || 'Select...';
            updateOptions();
        });

        document.addEventListener('click', () => {
            container.classList.remove('open');
        });
    }
})();
