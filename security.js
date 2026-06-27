// ============================================================
// 🔒 SECURITY MODULE - With Debug Mode
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // 🔥 DEBUG MODE - URL me ?debug add karne par security off
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.has('debug');
    
    if (isDebugMode) {
        console.log('🔓 Debug Mode Enabled - Security Disabled');
        console.log('📊 You can now use F12 / Console freely');
        return; // ⛔ Security completely disabled
    }

    // ============================================================
    // 🔒 SECURITY ENABLED (Normal Mode)
    // ============================================================

    // 1. Disable Right Click
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showSecurityAlert('⚠️ Right click is disabled for security reasons.');
        return false;
    });

    // 2. Disable Keyboard Shortcuts
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            showSecurityAlert('⚠️ Developer tools are disabled.');
            return false;
        }
        
        // Ctrl+Shift+I (Inspect)
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
            e.preventDefault();
            showSecurityAlert('⚠️ Developer tools are disabled.');
            return false;
        }
        
        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
            e.preventDefault();
            showSecurityAlert('⚠️ Developer tools are disabled.');
            return false;
        }
        
        // Ctrl+U (View Source)
        if (e.ctrlKey && (e.key === 'U' || e.keyCode === 85)) {
            e.preventDefault();
            showSecurityAlert('⚠️ View source is disabled.');
            return false;
        }
        
        // Ctrl+S (Save)
        if (e.ctrlKey && (e.key === 'S' || e.keyCode === 83)) {
            e.preventDefault();
            showSecurityAlert('⚠️ Save page is disabled.');
            return false;
        }
        
        // Ctrl+P (Print)
        if (e.ctrlKey && (e.key === 'P' || e.keyCode === 80)) {
            e.preventDefault();
            showSecurityAlert('⚠️ Print is disabled.');
            return false;
        }
    });

    // 3. Disable Drag and Drop
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });

    // 4. Block Dev Tools via console.log override
    window.console = {
        log: function() {},
        warn: function() {},
        error: function() {},
        info: function() {},
        debug: function() {},
        dir: function() {},
        table: function() {},
        trace: function() {},
        group: function() {},
        groupEnd: function() {},
        groupCollapsed: function() {},
        time: function() {},
        timeEnd: function() {},
        assert: function() {},
        count: function() {},
        profile: function() {},
        profileEnd: function() {}
    };

    // 5. Prevent opening in iframe (Clickjacking protection)
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // 6. Security Alert Function
    function showSecurityAlert(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #c44545;
            color: #fff;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-family: 'Segoe UI', sans-serif;
            z-index: 99999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            max-width: 350px;
            animation: slideIn 0.3s ease;
            pointer-events: none;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(function() {
                if (toast.parentNode) toast.remove();
            }, 500);
        }, 3000);
    }

    // 7. Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    console.log('🔒 Security module loaded! (Production Mode)');
    console.log('🔓 To disable: Add ?debug to URL');
})();
