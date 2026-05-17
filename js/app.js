(function () {
    const chatLog = document.getElementById('chatLog');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const nickInput = document.getElementById('nickInput');
    const setNickBtn = document.getElementById('setNickBtn');
    const roomLabel = document.getElementById('roomLabel');

    let currentHandle = localStorage.getItem('index0_nick') || '';
    let currentRoom = localStorage.getItem('index0_room') || 'main';

    let lastMessageTime = 0;

    function getTime() {
        return new Date().toTimeString().split(' ')[0];
    }

    function getColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 70%, 60%)`;
    }

    function loadChat() {
        return JSON.parse(localStorage.getItem('index0_chat_' + currentRoom) || '[]');
    }

    function saveChat(messages) {
        localStorage.setItem(
            'index0_chat_' + currentRoom,
            JSON.stringify(messages.slice(-200))
        );
    }

    function createMessage(msg) {
        const div = document.createElement('div');
        div.className = 'msg' + (msg.type === 'system' ? ' system' : '');

        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = `[${msg.time}]`;

        div.appendChild(time);

        if (msg.type === 'system') {
            const body = document.createElement('span');
            body.textContent = msg.text;
            div.appendChild(body);
        } else {
            const handle = document.createElement('span');
            handle.className = 'handle';
            handle.textContent = msg.handle + ':';
            handle.style.color = getColor(msg.handle);

            const body = document.createElement('span');
            body.textContent = ' ' + msg.text;

            div.appendChild(handle);
            div.appendChild(body);
        }

        return div;
    }

    function render() {
        const messages = loadChat();
        chatLog.innerHTML = '';
        messages.forEach(m => chatLog.appendChild(createMessage(m)));
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function addMessage(text, handle, type = 'user') {
        const msgs = loadChat();
        msgs.push({ time: getTime(), handle, text, type });
        saveChat(msgs);
        render();
    }

    function setNick(nick) {
        if (!nick || nick.trim().length < 2) return;

        currentHandle = nick.trim().replace(/\s/g, '_');
        localStorage.setItem('index0_nick', currentHandle);

        nickInput.value = currentHandle;
        messageInput.placeholder = `Message as ${currentHandle}...`;

        addMessage(`You are now ${currentHandle}`, 'SYSTEM', 'system');
    }

    function updateRoom() {
        roomLabel.textContent = '#' + currentRoom;
    }

    function handleInput() {
        const now = Date.now();
        if (now - lastMessageTime < 500) return;
        lastMessageTime = now;

        const raw = messageInput.value.trim();
        if (!raw) return;

        if (raw === '/help') {
            addMessage("Commands: /nick NAME, /join ROOM, /clear, /me", 'SYSTEM', 'system');
        }
        else if (raw.startsWith('/nick ')) {
            setNick(raw.substring(6));
        }
        else if (raw.startsWith('/join ')) {
            currentRoom = raw.substring(6).trim();
            localStorage.setItem('index0_room', currentRoom);
            addMessage(`Switched to room: ${currentRoom}`, 'SYSTEM', 'system');
            updateRoom();
            render();
        }
        else if (raw === '/clear') {
            if (confirm('Clear chat?')) {
                localStorage.setItem('index0_chat_' + currentRoom, '[]');
                render();
            }
        }
        else if (raw.startsWith('/me ')) {
            addMessage(`* ${currentHandle} ${raw.substring(4)}`, '', 'system');
        }
        else if (raw.startsWith('/')) {
            addMessage(`Unknown command`, 'SYSTEM', 'system');
        }
        else {
            if (!currentHandle) setNick('anon_' + Math.floor(Math.random() * 10000));
            addMessage(raw, currentHandle);
        }

        messageInput.value = '';
    }

    sendBtn.onclick = handleInput;
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleInput();
    });

    setNickBtn.onclick = () => setNick(nickInput.value);

    updateRoom();
    render();
    messageInput.focus();
})();
``