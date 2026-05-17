(function () {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const setNickBtn = document.getElementById('setNickBtn');
    const nickInput = document.getElementById('nickInput');

    function ensureNick() {
        if (!state.nick) {
            state.nick = 'anon_' + Math.floor(Math.random() * 10000);

            if (!state.users.includes(state.nick)) {
                state.users.push(state.nick);
            }

            storage.saveCore();
            storage.addMessage('Auto-assigned handle: ' + state.nick, 'SYSTEM', 'system');
        }
    }

    function sendMessage() {
        const now = Date.now();

        if (now - state.lastMessageTime < 400) {
            return;
        }

        state.lastMessageTime = now;

        const raw = messageInput.value.trim();

        if (!raw) {
            return;
        }

        if (commands.run(raw)) {
            messageInput.value = '';
            ui.refreshAll();
            return;
        }

        ensureNick();

        storage.addMessage(raw, state.nick, 'user');

        messageInput.value = '';
        ui.refreshAll();
    }

    function setNicknameFromBox() {
        const nick = nickInput.value.trim();

        if (nick.length < 2) {
            storage.addMessage('Nickname must be at least 2 characters.', 'SYSTEM', 'system');
            ui.refreshAll();
            return;
        }

        const cleanNick = nick.replace(/\s/g, '_');

        state.nick = cleanNick;

        if (!state.users.includes(cleanNick)) {
            state.users.push(cleanNick);
        }

        storage.saveCore();
        storage.addMessage('You are now ' + cleanNick, 'SYSTEM', 'system');

        ui.refreshAll();
    }

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    setNickBtn.addEventListener('click', setNicknameFromBox);

    nickInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            setNicknameFromBox();
        }
    });

    ui.init();

    if (!state.nick) {
        storage.addMessage('Welcome to Index0. Type /help for commands.', 'SYSTEM', 'system');
    }

    messageInput.focus();
})();