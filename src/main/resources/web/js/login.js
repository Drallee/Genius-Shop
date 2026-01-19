(function() {
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('error-message');
            const loginBtn = document.getElementById('login-btn');

            errorEl.style.display = 'none';
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';

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
                                    document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 48px;">✓</div><div style="font-size: 24px; color: #4ade80;">Login Confirmed!</div><div style="font-size: 14px; color: #888;">Redirecting...</div></div>';

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
                                        alert('Login failed: ' + (retryError.error || 'Unknown error'));
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

                    throw new Error(data.error || 'Login failed');
                }

                localStorage.setItem('sessionToken', data.sessionToken);
                localStorage.setItem('username', data.username);
                window.location.href = 'index.html';

            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });

        if (localStorage.getItem('sessionToken')) {
            window.location.href = 'index.html';
        }
})();
