"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
function errorHandler(err, req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            requestId: req.headers['x-request-id'],
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
    }
    const requestId = req.headers['x-request-id'] || crypto_1.default.randomUUID();
    console.error('[Error]', { requestId, method: req.method, path: req.path, message: err.message });
    const status = err.status ?? 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
    res.status(status).json({ error: message, code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', requestId });
}
