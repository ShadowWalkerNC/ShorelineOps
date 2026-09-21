"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("./routes/auth");
const residents_1 = require("./routes/residents");
const audit_1 = require("./routes/audit");
const menu_1 = require("./routes/menu");
const production_1 = require("./routes/production");
const admin_1 = require("./routes/admin");
const timecard_1 = require("./routes/timecard");
const kitchen_1 = require("./routes/kitchen");
const purchasing_1 = require("./routes/purchasing");
const distributor_1 = require("./routes/distributor");
const reporting_1 = require("./routes/reporting");
const setup_1 = require("./routes/setup");
const ehr_1 = require("./routes/ehr");
const recipes_1 = require("./routes/recipes");
const enterprise_1 = require("./routes/enterprise");
const inventory_1 = require("./routes/inventory");
const trayruns_1 = require("./routes/trayruns");
const errorHandler_1 = require("./middleware/errorHandler");
const requireAuth_1 = require("./middleware/requireAuth");
const pool_1 = require("./db/pool");
const migrate_1 = require("./db/migrate");
const seed_1 = require("./db/seed");
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
let databaseReady = false;
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const generated = crypto_1.default.randomBytes(32).toString('hex');
    console.warn('[Shoreline API] JWT_SECRET missing or <32 chars — generated fallback runtime secret');
    process.env.JWT_SECRET = process.env.JWT_SECRET || generated;
}
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
}));
app.use((0, compression_1.default)());
// CORS: FRONTEND_URL may be a comma-separated list of allowed origins
const rawOrigins = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        if (/\.up\.railway\.app$/.test(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
// Stripe webhook signature verification needs the RAW request bytes (A08), so the
// webhook path is parsed with express.raw BEFORE the global JSON parser runs.
app.use('/api/billing/webhook', express_1.default.raw({ type: 'application/json', limit: '1mb' }));
// Stash the raw request bytes (req.rawBody) so HMAC-signed webhooks (EHR) can
// verify signatures against the exact payload the sender signed.
app.use(express_1.default.json({
    limit: '1mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);
app.use('/api/auth', authLimiter);
const cache_1 = require("./middleware/cache");
const mcp_1 = require("./routes/mcp");
const healer_1 = require("./agent/healer");
const nightlyForecast_1 = require("./jobs/nightlyForecast");
const webhooks_1 = require("./routes/webhooks");
const hardware_1 = require("./routes/hardware");
const billing_1 = require("./routes/billing");
const tenantContext_1 = require("./middleware/tenantContext");
// Global Tenant Context
app.use('/api', tenantContext_1.tenantContextMiddleware);
// Do not let API routes pretend to work while migrations are incomplete. Static
// marketing and demo assets remain available on services without a database.
app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/ready')
        return next();
    if (!databaseReady) {
        return res.status(503).json({ error: 'Database is initializing or unavailable' });
    }
    next();
});
// Routes
app.use('/api/setup', setup_1.setupRouter);
app.use('/api/auth', auth_1.authRouter);
app.use('/api/billing', billing_1.billingRouter);
app.use('/api/residents', requireAuth_1.requireAuth, residents_1.residentsRouter);
app.use('/api/audit', requireAuth_1.requireAuth, audit_1.auditRouter);
app.use('/api/menu', requireAuth_1.requireAuth, (0, cache_1.httpCacheMiddleware)(60, 'menu'), menu_1.menuRouter);
app.use('/api/recipes', requireAuth_1.requireAuth, (0, cache_1.httpCacheMiddleware)(60, 'recipes'), recipes_1.recipesRouter);
app.use('/api/production', requireAuth_1.requireAuth, production_1.productionRouter);
app.use('/api/admin', requireAuth_1.requireAuth, admin_1.adminRouter);
app.use('/api/kitchen', requireAuth_1.requireAuth, kitchen_1.kitchenRouter);
app.use('/api/purchasing', requireAuth_1.requireAuth, purchasing_1.purchasingRouter);
app.use('/api/distributor', requireAuth_1.requireAuth, distributor_1.distributorRouter);
app.use('/api/inventory', requireAuth_1.requireAuth, inventory_1.inventoryRouter);
app.use('/api/trayruns', requireAuth_1.requireAuth, trayruns_1.trayrunsRouter);
app.use('/api/reporting', requireAuth_1.requireAuth, reporting_1.reportingRouter);
app.use('/api/enterprise', enterprise_1.enterpriseRouter);
app.use('/api/ehr', ehr_1.ehrRouter);
app.use('/api/mcp', mcp_1.mcpRouter);
app.use('/api/webhooks', webhooks_1.webhooksRouter);
app.use('/api/hardware', requireAuth_1.requireAuth, hardware_1.hardwareRouter);
// Optional Pluggable Modules
if (process.env.ENABLE_TIMECARD_PLUGIN !== 'false') {
    app.use('/api/timecard', timecard_1.timecardRouter);
}
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Health and Readiness Probes for Kubernetes / Docker / Cloud Load Balancers / Render
const handleHealth = (_req, res) => {
    res.json({
        status: 'ok',
        service: 'ShorelineOps API',
        version: '6.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
};
const handleReady = async (_req, res) => {
    if (!databaseReady) {
        return res.status(503).json({ status: 'unready', database: 'initializing_or_unavailable' });
    }
    try {
        const { rows } = await pool_1.pool.query('SELECT 1 as ready');
        if (rows && rows.length > 0) {
            return res.json({
                status: 'ready',
                database: 'connected',
                timestamp: new Date().toISOString(),
            });
        }
        return res.status(503).json({ status: 'unready', database: 'no_rows' });
    }
    catch (err) {
        return res.status(503).json({
            status: 'unready',
            database: 'disconnected',
            error: err.message,
        });
    }
};
app.get('/health', handleHealth);
app.get('/api/health', handleHealth);
app.get('/ready', handleReady);
app.get('/api/ready', handleReady);
// Check if frontend build exists to serve single-port container
// In Docker container, server runs from /app/server and dist is at /app/dist (../dist)
// In local/Nixpacks, server runs from server/dist and root dist is at ../../dist
const possibleDistPaths = [
    path_1.default.resolve(__dirname, '../../dist'),
    path_1.default.resolve(__dirname, '../dist'),
    path_1.default.resolve(process.cwd(), '../dist'),
    path_1.default.resolve(process.cwd(), 'dist'),
];
const clientDistPath = possibleDistPaths.find((p) => fs_1.default.existsSync(p)) || possibleDistPaths[0];
console.log(`[Shoreline API] Static assets path resolved to: ${clientDistPath} (exists: ${fs_1.default.existsSync(clientDistPath)})`);
if (fs_1.default.existsSync(clientDistPath)) {
    // OpenAPI 3.1 Documentation Endpoint
    const openApiSpecPath = path_1.default.resolve(__dirname, 'docs/openapi.json');
    app.get('/api/docs', (_req, res) => {
        if (fs_1.default.existsSync(openApiSpecPath)) {
            res.sendFile(openApiSpecPath);
        }
        else {
            res.json({ message: 'Shoreline Care OS OpenAPI 3.1 Spec' });
        }
    });
    app.use(express_1.default.static(clientDistPath));
    // 1. /demo and /demo/* → Public Interactive Demo (sandboxed / mock fallback, no credentials required)
    app.get(['/demo', '/demo/*'], (_req, res, next) => {
        const demoIndex = path_1.default.join(clientDistPath, 'demo', 'index.html');
        if (fs_1.default.existsSync(demoIndex)) {
            return res.sendFile(demoIndex);
        }
        // If demo sub-bundle is missing, fall back to root index
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'), (err) => {
            if (err)
                next(err);
        });
    });
    // 2. /app and /app/* → Production Gatekept SaaS Platform (requires real JWT authentication)
    app.get(['/app', '/app/*'], (_req, res, next) => {
        const appIndex = path_1.default.join(clientDistPath, 'app', 'index.html');
        if (fs_1.default.existsSync(appIndex)) {
            return res.sendFile(appIndex);
        }
        // Fall back to root index
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'), (err) => {
            if (err)
                next(err);
        });
    });
    // 3. /login redirect -> send users attempting root /login to the gatekept SaaS login
    app.get('/login', (_req, res) => {
        res.redirect(301, '/app/login');
    });
    // 4. Everything else → Public Astro Marketing Website (/pricing, /story, /distributors, etc.)
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ready') {
            return next();
        }
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'), (err) => {
            if (err)
                next(err);
        });
    });
}
else {
    // Root API landing page
    app.get('/', (_req, res) => {
        res.json({
            service: 'Shoreline Operations Platform API',
            status: 'online',
            version: '5.0.0',
            documentation: '/api/docs',
            health: '/health',
            ready: '/ready',
            frontend: 'http://localhost:3000',
            endpoints: [
                '/api/setup',
                '/api/auth',
                '/api/residents',
                '/api/menu',
                '/api/production',
                '/api/purchasing',
                '/api/reporting',
                '/api/distributor',
                '/api/kitchen',
                '/api/timecard',
                '/api/ehr',
                '/api/admin',
            ],
        });
    });
}
// Global error handler
app.use(errorHandler_1.errorHandler);
async function initializeDatabase() {
    try {
        await (0, migrate_1.runMigrations)();
        if ((0, seed_1.isDemoSeedEnabled)())
            await (0, seed_1.runSeed)();
        else if (process.env.SHORELINE_DEMO_SEED === 'true') {
            console.warn('[Shoreline API] Demo seeding refused in production.');
        }
        databaseReady = true;
        console.log('[Shoreline API] Database migrations verified.');
        healer_1.globalHealerBot.startDaemon(300000);
        (0, nightlyForecast_1.startNightlyForecastRollup)();
    }
    catch (err) {
        databaseReady = false;
        // A configured production database must be usable before the API accepts
        // traffic. Static-only Railway services may omit DATABASE_URL and continue
        // serving the public marketing/demo bundles with /ready returning 503.
        if (isProd && process.env.DATABASE_URL) {
            throw err;
        }
        console.warn('[Shoreline API] Database unavailable; starting in static-only mode:', err.message);
    }
}
async function startServer() {
    await initializeDatabase();
    const server = app.listen(PORT, () => {
        console.log(`[Shoreline API] Running on port ${PORT} (${process.env.NODE_ENV})`);
    });
    // High-Frequency Real-Time WebSocket stream handler for Kitchen Telemetry (/api/ws/kitchen)
    server.on('upgrade', (request, socket, _head) => {
        if (request.url === '/api/ws/kitchen') {
            socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n' +
                '\r\n');
            console.log('[KitchenWS] Client connected to real-time tray assembly & probe telemetry stream');
        }
        else {
            socket.destroy();
        }
    });
    return server;
}
if (require.main === module) {
    startServer().catch((err) => {
        console.error('[Shoreline API] FATAL: database initialization failed:', err.message);
        process.exit(1);
    });
}
exports.default = app;
