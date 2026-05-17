window.state = {
    nick: localStorage.getItem('index0_nick') || '',
    mode: localStorage.getItem('index0_mode') || 'channel',
    currentChannel: localStorage.getItem('index0_current_channel') || 'main',
    currentDM: localStorage.getItem('index0_current_dm') || '',
    channels: JSON.parse(localStorage.getItem('index0_channels') || '["main","random"]'),
    dms: JSON.parse(localStorage.getItem('index0_dms') || '["system"]'),
}