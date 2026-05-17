const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

function send() {
    const text = input.value.trim();
    if (!text) return;

    if (commands.run(text)) {
        input.value = '';
        ui.render();
        return;
    }

    if (!state.nick) {
        state.nick = 'anon_' + Math.floor(Math.random() * 1000);
    }

    chat.add(text, state.nick);
    input.value = '';
    ui.render();
}

sendBtn.onclick = send;

input.addEventListener('keypress', e => {
    if (e.key === 'Enter') send();
});

ui.updateRoom();
ui.render();
ui.renderRooms();