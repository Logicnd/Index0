window.state = {
    room: localStorage.getItem('room') || 'main',
    nick: localStorage.getItem('nick') || null,
    rooms: ['main', 'random']
};