// Bot-State: zentrale Quelle der Wahrheit über den Bot-Status
// Wird sowohl vom Bot-Modul selbst als auch vom Admin-Controller gelesen.

const state = {
    status: 'offline', // 'offline' | 'connecting' | 'online' | 'error' | 'disabled'
    client: null,
    startedAt: null,
    lastError: null,
    guild: null
};

const setStatus = (status, extra = {}) => {
    state.status = status;
    if (extra.lastError !== undefined) state.lastError = extra.lastError;
    if (extra.startedAt !== undefined) state.startedAt = extra.startedAt;
    if (extra.client !== undefined) state.client = extra.client;
    if (extra.guild !== undefined) state.guild = extra.guild;
};

const getStatus = () => ({
    status: state.status,
    started_at: state.startedAt,
    uptime_seconds: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : null,
    last_error: state.lastError,
    guild_name: state.guild?.name || null,
    guild_id: state.guild?.id || null,
    member_count: state.guild?.memberCount || null
});

module.exports = { state, setStatus, getStatus };
