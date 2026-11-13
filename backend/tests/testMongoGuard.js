const mongoose = require('mongoose');

/**
 * Checks whether a MongoDB connection string points to a remote/cloud/Atlas database.
 */
const isProductionOrAtlasUri = (uri) => {
    if (!uri || typeof uri !== 'string') return true;
    const lower = uri.toLowerCase();
    return (
        lower.includes('mongodb.net') ||
        lower.includes('cluster') ||
        lower.includes('atlas') ||
        lower.includes('replicaset') ||
        (!lower.includes('127.0.0.1') && !lower.includes('localhost') && !lower.includes('test'))
    );
};

/**
 * Returns a safe test database URI ONLY if explicitly provided via TEST_MONGO_URI
 * and strictly verified to not point to Atlas or remote clusters.
 * Never falls back to process.env.MONGO_URI.
 */
const getSafeTestMongoUri = () => {
    const testUri = process.env.TEST_MONGO_URI;
    if (!testUri) {
        return null;
    }
    if (isProductionOrAtlasUri(testUri)) {
        throw new Error(`SECURITY FATAL: TEST_MONGO_URI points to remote/production cluster: ${testUri}`);
    }
    return testUri;
};

/**
 * Checks if a safe local test database is configured.
 */
const hasSafeTestMongo = () => Boolean(getSafeTestMongoUri());

/**
 * Reason string to use for native test skipping if no safe local test database is configured.
 */
const getDbSkipReason = () => {
    const safeUri = getSafeTestMongoUri();
    if (!safeUri) {
        return 'Safe isolated test database (TEST_MONGO_URI) is not configured. Production Atlas cluster connection blocked.';
    }
    return false;
};

/**
 * Connects to the safe test database. Throws an error if called when no safe database exists.
 */
const connectSafeTestMongo = async () => {
    const safeUri = getSafeTestMongoUri();
    if (!safeUri) {
        throw new Error('Cannot connect: No safe isolated test database configured.');
    }
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(safeUri);
    }
    return safeUri;
};

/**
 * Creates a wrapped test function that marks tests as skipped with Node.js native test runner
 * when no safe isolated test database is available.
 */
const createDbSafeTest = (nodeTest, customReason = null) => {
    const skipReason = customReason !== null ? customReason : getDbSkipReason();
    return (title, optionsOrFn, maybeFn) => {
        if (!skipReason) {
            return nodeTest(title, optionsOrFn, maybeFn);
        }
        if (typeof optionsOrFn === 'function') {
            return nodeTest(title, { skip: skipReason }, optionsOrFn);
        }
        const options = typeof optionsOrFn === 'object' && optionsOrFn ? { ...optionsOrFn, skip: skipReason } : { skip: skipReason };
        return nodeTest(title, options, maybeFn);
    };
};

module.exports = {
    isProductionOrAtlasUri,
    getSafeTestMongoUri,
    hasSafeTestMongo,
    getDbSkipReason,
    connectSafeTestMongo,
    createDbSafeTest
};
