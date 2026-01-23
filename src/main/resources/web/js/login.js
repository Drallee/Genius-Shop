(function() {
    let translations = {};
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
                }
                
                applyTranslations();
                loadLanguages();
            }
        } catch (error) {
            console.error('Failed to load translations:', error);
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
                            'ru_RU': 'Русский',
                            'de_DE': 'Deutsch',
                            'fr_FR': 'Français',
                            'tr_TR': 'Türkçe',
                            'ro_RO': 'Română',
                            'es_MX': 'Español (MX)',
                            'es_ES': 'Español (ES)',
                            'es_AR': 'Español (AR)',
                            'pt_BR': 'Português (BR)',
                            'pt_PT': 'Português (PT)',
                            'vi_VN': 'Tiếng Việt',
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

    loadTranslations();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('error-message');
        const loginBtn = document.getElementById('login-btn');

        errorEl.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = '...'; // Temporary until translated

        try {
            const response = await fetch(`api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if this is a pending confirmation (IP bypass)
                if (response.status === 403 && data.status === 'pending_confirmation') {
                    // Show waiting for confirmation screen
                    document.body.innerHTML = `
                        <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 25px; padding: 40px; text-align: center;">
                            <div style="font-size: 48px; animation: pulse 2s ease-in-out infinite;">⚠️</div>
                            <div style="font-size: 28px; font-weight: 700;">${t('web-editor.login.security-title', 'Security Confirmation Required')}</div>
                            <div style="font-size: 16px; color: #aaa; max-width: 500px; line-height: 1.6;">
                                ${t('web-editor.login.security-text', 'You are logging in from a different IP address.<br>Please check your Minecraft game and confirm the login request.')}
                            </div>
                            <div style="margin-top: 20px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 14px; color: #888; margin-bottom: 8px;">${t('web-editor.login.waiting', 'Waiting for confirmation...')}</div>
                                <div style="font-size: 12px; color: #666;">${t('web-editor.login.retry-auto', 'This will retry automatically')}</div>
                            </div>
                            <div id="countdown" style="font-size: 14px; color: #666; margin-top: 10px;">${t('web-editor.login.retry-in', 'Retrying in')} <span id="timer">10</span>s</div>
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
                            alert(t('web-editor.login.timeout', 'Confirmation timeout. Please try logging in again.'));
                            window.location.reload();
                            return;
                        }

                        try {
                            const retryResponse = await fetch(`api/login`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ username, password })
                            });

                            if (retryResponse.ok) {
                                clearInterval(pollInterval);
                                clearInterval(countdownInterval);
                                const retryData = await retryResponse.json();
                                localStorage.setItem('sessionToken', retryData.sessionToken);
                                localStorage.setItem('username', retryData.username);

                                // Show success and redirect
                                document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 48px;">✓</div><div style="font-size: 24px; color: #4ade80;">${t('web-editor.login.confirmed', 'Login Confirmed!')}</div><div style="font-size: 14px; color: #888;">${t('web-editor.login.redirecting', 'Redirecting...')}</div></div>`;

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
})();
