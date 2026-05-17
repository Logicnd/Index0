window.ui = {
    init() {
        this.cache();
        this.syncInputs();
        this.updateRoomHeader();
        this.renderChannels();
        this.renderDMs();
        this.renderUsers();
        this.renderMessages();
    },

    cache() {
        this.chatLog = document.getElementById('chatLog');
        this.messageInput = document.getElementById('messageInput');
        this.nickInput = document.getElementById('nickInput');
        this.roomLabel = document.getElementById('roomLabel');
        this.roomTypeLabel = document.getElementById('roomTypeLabel');
        this.channelList = document.getElementById('channelList');
        this.dmList = document.getElementById('dmList');
        this.userList = document.getElementById('userList');
    },

    syncInputs() {
        if (state.nick) {
            this.nickInput.value = state.nick;
            this.messageInput.placeholder = this.getPlaceholder();
        } else {
            this.messageInput.placeholder = 'Set a handle or type to auto-assign...';
        }
    },

    getPlaceholder() {
        if (state.mode === 'dm') {
            return 'Message @' + state.currentDM + ' as ' + state.nick + '...';
        }

        return 'Message #' + state.currentChannel + ' as ' + state.nick + '...';
    },

    updateRoomHeader() {
        if (state.mode === 'dm') {
            this.roomLabel.textContent = '@' + state.currentDM;
            this.roomTypeLabel.textContent = 'private';
        } else {
            this.roomLabel.textContent = '#' + state.currentChannel;
            this.roomTypeLabel.textContent = 'channel';
        }

        this.messageInput.placeholder = this.getPlaceholder();
    },

    renderChannels() {
        this.channelList.innerHTML = '';

        state.channels.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'sidebar-item';

            if (state.mode === 'channel' && state.currentChannel === channel) {
                item.classList.add('active');
            }

            const name = document.createElement('span');
            name.textContent = '#' + channel;

            item.appendChild(name);

            if (storage.hasUnread('channel', channel)) {
                const dot = document.createElement('span');
                dot.className = 'unread-dot';
                item.appendChild(dot);
            }

            item.addEventListener('click', () => {
                state.mode = 'channel';
                state.currentChannel = channel;
                storage.clearUnread('channel', channel);
                storage.saveCore();
                this.refreshAll();
            });

            this.channelList.appendChild(item);
        });
    },

    renderDMs() {
        this.dmList.innerHTML = '';

        state.dms.forEach(dm => {
            const item = document.createElement('div');
            item.className = 'sidebar-item';

            if (state.mode === 'dm' && state.currentDM === dm) {
                item.classList.add('active');
            }

            const name = document.createElement('span');
            name.textContent = '@' + dm;

            item.appendChild(name);

            if (storage.hasUnread('dm', dm)) {
                const dot = document.createElement('span');
                dot.className = 'unread-dot';
                item.appendChild(dot);
            }

            item.addEventListener('click', () => {
                state.mode = 'dm';
                state.currentDM = dm;
                storage.clearUnread('dm', dm);
                storage.saveCore();
                this.refreshAll();
            });

            this.dmList.appendChild(item);
        });
    },

    renderUsers() {
        this.userList.innerHTML = '';

        state.users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';

            const status = document.createElement('span');
            status.className = 'user-status';
            status.textContent = '●';

            const name = document.createElement('span');
            name.textContent = user;

            item.appendChild(status);
            item.appendChild(name);

            item.addEventListener('click', () => {
                this.openDM(user);
            });

            this.userList.appendChild(item);
        });
    },

    openDM(user) {
        if (!state.dms.includes(user)) {
            state.dms.push(user);
        }

        state.mode = 'dm';
        state.currentDM = user;

        storage.clearUnread('dm', user);
        storage.saveCore();

        this.refreshAll();
    },

    renderMessages() {
        const messages = storage.loadMessages();

        this.chatLog.innerHTML = '';

        if (messages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'msg system';
            empty.textContent = '[--:--:--] No messages here yet.';
            this.chatLog.appendChild(empty);
            return;
        }

        messages.forEach(msg => {
            this.chatLog.appendChild(this.createMessageElement(msg));
        });

        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    },

    createMessageElement(msg) {
        const div = document.createElement('div');
        div.className = 'msg';

        if (msg.type === 'system') {
            div.classList.add('system');
        }

        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = '[' + msg.time + ']';

        div.appendChild(time);

        if (msg.type === 'system') {
            const body = document.createElement('span');
            body.className = 'body';
            body.textContent = ' ' + msg.text;
            div.appendChild(body);
            return div;
        }

        const handle = document.createElement('span');
        handle.className = 'handle';
        handle.textContent = msg.handle + ':';
        handle.style.color = this.colorFromName(msg.handle);

        const body = document.createElement('span');
        body.className = 'body';
        body.textContent = ' ' + msg.text;

        div.appendChild(handle);
        div.appendChild(body);

        return div;
    },

    colorFromName(name) {
        let hash = 0;

        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        return 'hsl(' + Math.abs(hash % 360) + ', 75%, 62%)';
    },

    refreshAll() {
        this.updateRoomHeader();
        this.renderChannels();
        this.renderDMs();
        this.renderUsers();
        this.renderMessages();
        this.syncInputs();
    }
};