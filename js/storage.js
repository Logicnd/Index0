window.storage = {
    saveCore() {
        localStorage.setItem('index0_nick', state.nick);
        localStorage.setItem('index0_mode', state.mode);
        localStorage.setItem('index0_current_channel', state.currentChannel);
        localStorage.setItem('index0_current_dm', state.currentDM);
        localStorage.setItem('index0_channels', JSON.stringify(state.channels));
        localStorage.setItem('index0_dms', JSON.stringify(state.dms));
        localStorage.setItem('index0_users', JSON.stringify(state.users));
        localStorage.setItem('index0_unread', JSON.stringify(state.unread));
    },

    getActiveKey() {
        if (state.mode === 'dm') {
            return 'index0_dm_' + state.currentDM;
        }

        return 'index0_channel_' + state.currentChannel;
    },

    loadMessages() {
        return JSON.parse(localStorage.getItem(this.getActiveKey()) || '[]');
    },

    saveMessages(messages) {
        localStorage.setItem(
            this.getActiveKey(),
            JSON.stringify(messages.slice(-250))
        );
    },

    addMessage(text, handle, type) {
        const messages = this.loadMessages();

        messages.push({
            time: this.getTime(),
            text: text,
            handle: handle,
            type: type || 'user'
        });

        this.saveMessages(messages);
    },

    getTime() {
        return new Date().toTimeString().split(' ')[0];
    },

    markUnread(targetType, targetName) {
        const key = targetType + ':' + targetName;

        if (state.mode === targetType) {
            if (targetType === 'channel' && state.currentChannel === targetName) return;
            if (targetType === 'dm' && state.currentDM === targetName) return;
        }

        state.unread[key] = true;
        this.saveCore();
    },

    clearUnread(targetType, targetName) {
        const key = targetType + ':' + targetName;
        delete state.unread[key];
        this.saveCore();
    },

    hasUnread(targetType, targetName) {
        const key = targetType + ':' + targetName;
        return !!state.unread[key];
    }
};