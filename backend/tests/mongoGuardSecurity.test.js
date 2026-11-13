const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { 
    isProductionOrAtlasUri, 
    getSafeTestMongoUri, 
    hasSafeTestMongo, 
    getDbSkipReason, 
    connectSafeTestMongo,
    createDbSafeTest 
} = require('./testMongoGuard');

describe('MongoDB Test Isolation & Production Guard Suite', () => {

    test('1. Atlas and cloud URLs are strictly identified as production/remote', () => {
        const atlasUri = 'mongodb://user:pass@ac-gg5p3e9-shard-00-00.myctk3n.mongodb.net:27017/?ssl=true';
        const atlasSrv = 'mongodb+srv://admin:pass@cluster0.abcde.mongodb.net/cricket_auction';
        const replicaSetUri = 'mongodb://somehost:27017/?replicaSet=atlas-xlpumv-shard-0';

        assert.equal(isProductionOrAtlasUri(atlasUri), true);
        assert.equal(isProductionOrAtlasUri(atlasSrv), true);
        assert.equal(isProductionOrAtlasUri(replicaSetUri), true);
    });

    test('2. Missing, empty, or non-string URIs default to unsafe (true)', () => {
        assert.equal(isProductionOrAtlasUri(null), true);
        assert.equal(isProductionOrAtlasUri(undefined), true);
        assert.equal(isProductionOrAtlasUri(''), true);
        assert.equal(isProductionOrAtlasUri(12345), true);
    });

    test('3. Localhost and 127.0.0.1 isolated test URIs are identified as safe (false)', () => {
        assert.equal(isProductionOrAtlasUri('mongodb://127.0.0.1:27017/cricket_test_isolated'), false);
        assert.equal(isProductionOrAtlasUri('mongodb://localhost:27017/cricket_test_isolated'), false);
    });

    test('4. getSafeTestMongoUri refuses to fallback to process.env.MONGO_URI', () => {
        // Even if process.env.MONGO_URI is set (e.g. to Atlas in .env)
        const oldTestMongoUri = process.env.TEST_MONGO_URI;
        delete process.env.TEST_MONGO_URI;

        try {
            const result = getSafeTestMongoUri();
            assert.equal(result, null, 'Must return null when TEST_MONGO_URI is not explicitly provided');
        } finally {
            if (oldTestMongoUri) process.env.TEST_MONGO_URI = oldTestMongoUri;
        }
    });

    test('5. getSafeTestMongoUri throws FATAL error if TEST_MONGO_URI points to Atlas or remote cluster', () => {
        const oldTestMongoUri = process.env.TEST_MONGO_URI;
        process.env.TEST_MONGO_URI = 'mongodb+srv://user:pass@cluster0.myctk3n.mongodb.net/test';

        try {
            assert.throws(() => getSafeTestMongoUri(), /SECURITY FATAL/);
        } finally {
            if (oldTestMongoUri) process.env.TEST_MONGO_URI = oldTestMongoUri;
            else delete process.env.TEST_MONGO_URI;
        }
    });

    test('6. getSafeTestMongoUri returns valid URI when TEST_MONGO_URI points to localhost', () => {
        const oldTestMongoUri = process.env.TEST_MONGO_URI;
        process.env.TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/isolated_ci_test';

        try {
            const result = getSafeTestMongoUri();
            assert.equal(result, 'mongodb://127.0.0.1:27017/isolated_ci_test');
        } finally {
            if (oldTestMongoUri) process.env.TEST_MONGO_URI = oldTestMongoUri;
            else delete process.env.TEST_MONGO_URI;
        }
    });

    test('7. hasSafeTestMongo and getDbSkipReason behave predictably without TEST_MONGO_URI', () => {
        const oldTestMongoUri = process.env.TEST_MONGO_URI;
        delete process.env.TEST_MONGO_URI;

        try {
            assert.equal(hasSafeTestMongo(), false);
            assert.match(getDbSkipReason(), /Safe isolated test database/);
        } finally {
            if (oldTestMongoUri) process.env.TEST_MONGO_URI = oldTestMongoUri;
        }
    });

    test('8. connectSafeTestMongo rejects connection if no safe database is set', async () => {
        const oldTestMongoUri = process.env.TEST_MONGO_URI;
        delete process.env.TEST_MONGO_URI;

        try {
            await assert.rejects(
                () => connectSafeTestMongo(),
                /Cannot connect: No safe isolated test database configured/
            );
        } finally {
            if (oldTestMongoUri) process.env.TEST_MONGO_URI = oldTestMongoUri;
        }
    });

    test('9. createDbSafeTest injects skip reason into test runner options', (t) => {
        let captured = null;
        const fakeNodeTest = (title, options, fn) => {
            captured = { title, options, fn };
        };

        const safeTest = createDbSafeTest(fakeNodeTest, 'Test skip reason');
        const dummyFn = () => {};
        safeTest('my sample test', dummyFn);

        assert.equal(captured.title, 'my sample test');
        assert.equal(captured.options.skip, 'Test skip reason');
        assert.equal(captured.fn, dummyFn);
    });

});
