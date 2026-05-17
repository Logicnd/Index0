window.commands = {

    run(input) {
        if (input === '/help') {
            chat.add('Commands: /nick /join /clear /me', 'SYSTEM', 'system');
        }

        else if (input.startsWith('/nick ')) {
            state.nick = input.substring(6);
            localStorage.setItem('nick', state.nick);
        }

        else if (input.startsWith('/join ')) {
            const room = input.substring(6);

            if (!state.rooms.includes(room))
                state.rooms.push(room);

            state.room = room;
            localStorage.setItem('room', room);

            ui.updateRoom();
            ui.render();
        }

        else if (input === '/clear') {
            localStorage.setItem('chat_' + state.room, '[]');
        }

        else if (input.startsWith('/me ')) {
            chat.add(`* ${state.nick} ${input.substring(4)}`, '', 'system');
        }

        else {
            return false;
        }

        return true;
    }
};