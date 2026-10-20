const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Allow non-browser requests (e.g. mobile apps, test runners, curl)
    const allowedOrigins = [
        'https://cricleaguemanager.in',
        'https://www.cricleaguemanager.in',
        process.env.CLIENT_URL,
        process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) return true;

    // Allow localhost and 127.0.0.1 on any port for local development and testing
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return true;
    }

    return false;
};

const socketCorsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS origin not allowed'));
        }
    },
    credentials: true
};

module.exports = { isAllowedOrigin, socketCorsOptions };
