window.commands = {
    run(raw) {
        if (!raw.startsWith('/')) {
            return false;
        }

        if (raw === '/help') {
            storage.addMessage(
                'Commands: /help, /nick NAME, /join ROOM, /dm USER, /users, /clear, /me ACTION',
                'SYSTEM',
                'system'
            );
            return true;
        }

        if (raw.startsWith('/nick ')) {
            const nick = raw.substring(6).trim();

            if (nick.length < 2) {
                storage.addMessage('Nickname must be at least 2 characters.', 'SYSTEM', 'system');
                return true;
            }

            const cleanNick = nick.replace(/\s/g, '_');

            state.nick = cleanNick;

            if (!state.users.includes(cleanNick)) {
                state.users.push(cleanNick);
            }

            storage.saveCore();
            storage.addMessage('You are now ' + cleanNick, 'SYSTEM', 'system');
            return true;
        }

        if (raw.startsWith('/join ')) {
            const channel = raw.substring(6).trim().replace(/\s/g, '_');

            if (!channel) {
                storage.addMessage('Usage: /join room_name', 'SYSTEM', 'system');
                return true;
            }

            if (!state.channels.includes(channel)) {
                state.channels.push(channel);
            }

            state.mode = 'channel';
            state.currentChannel = channel;

            storage.clearUnread('channel', channel);
            storage.saveCore();

            storage.addMessage('Joined #' + channel, 'SYSTEM', 'system');
            return true;
        }

        if (raw.startsWith('/dm ')) {
            const user = raw.substring(4).trim().replace(/\s/g, '_');

            if (!user) {
                storage.addMessage('Usage: /dm username', 'SYSTEM', 'system');
                return true;
            }

            if (!state.dms.includes(user)) {
                state.dms.push(user);
            }

            if (!state.users.includes(user)) {
                state.users.push(user);
            }

            state.mode = 'dm';
            state.currentDM = user;

            storage.clearUnread('dm', user);
            storage.saveCore();

            storage.addMessage('Opened DM with @' + user, 'SYSTEM', 'system');
            return true;
        }

        if (raw === '/users') {
            storage.addMessage('Known users: ' + state.users.join(', '), 'SYSTEM', 'system');
            return true;
        }

        if (raw === '/clear') {
            if (confirm('Clear this chat?')) {
                storage.saveMessages([]);
            }

            return true;
        }

        if (raw.startsWith('/me ')) {
            const action = raw.substring(4).trim();

            if (!state.nick) {
                state.nick = 'anon_' + Math.floor(Math.random() * 10000);
                storage.saveCore();
            }

            storage.addMessage('* ' + state.nick + ' ' + action, 'SYSTEM', 'system');
            return true;
        }

        storage.addMessage('Unknown command. Type /help', 'SYSTEM', 'system');
        return true;
    }
};