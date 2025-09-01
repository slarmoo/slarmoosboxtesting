//for live editor typeless to work with shared array buffers
module.exports = {
    middleware: [
        (req, res, next) => {
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            next();
        },
    ],
};