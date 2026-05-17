window.chat = {
    load() {
        return JSON.parse(localStorage.getItem('chat_' + state.room) || '[]');
    },

    save(messages) {
        localStorage.setItem('chat_' + state.room, JSON.stringify(messages.slice(-200)));
    },

    add(text, handle, type = 'user') {
        const msgs = this.load();
        msgs.push({ time: new Date().toLocaleTimeString(), text, handle, type });
        this.save(msgs);
    }
};