window.ui = {

    render() {
        const chatLog = document.getElementById('chatLog');
        chatLog.innerHTML = '';

        chat.load().forEach(msg => {
            const div = document.createElement('div');
            div.className = 'msg';

            if (msg.type === 'system') {
                div.textContent = `[${msg.time}] ${msg.text}`;
            } else {
                div.innerHTML = `<span class="time">[${msg.time}]</span> 
                <span class="handle">${msg.handle}:</span> ${msg.text}`;
            }

            chatLog.appendChild(div);
        });

        chatLog.scrollTop = chatLog.scrollHeight;
    },

    updateRoom() {
        document.getElementById('roomLabel').textContent = '#' + state.room;
    },

    renderRooms() {
        const list = document.getElementById('roomList');
        list.innerHTML = '';

        state.rooms.forEach(room => {
            const div = document.createElement('div');
            div.textContent = '#' + room;

            div.onclick = () => {
                state.room = room;
                localStorage.setItem('room', room);
                this.updateRoom();
                this.render();
            };

            list.appendChild(div);
        });
    }
};