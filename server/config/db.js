const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

let localMongoInstance = null;
let lastConnectionStatus = {
    attemptedUriKey: null,
    sanitizedTargetHost: null,
    atlasError: null,
    connectedToAtlas: false,
    usingFallback: false
};

const getConnectionStatus = () => ({ ...lastConnectionStatus });

const startLocalMongo = async () => {
    try {
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const dbPath = path.resolve(__dirname, "..", ".local_mongo_data");
        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }

        console.log("🚀 Starting local persistent MongoDB instance...");
        localMongoInstance = await MongoMemoryServer.create({
            instance: {
                dbPath,
                storageEngine: "wiredTiger",
                dbName: "intellmeet"
            }
        });

        const localUri = localMongoInstance.getUri("intellmeet");
        console.log(`📍 Local MongoDB running at: ${localUri}`);
        return localUri;
    } catch (err) {
        console.error("❌ Failed to start local Mongo instance:", err.message);
        throw err;
    }
};

const migrateLegacyData = async () => {
    try {
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        if (dbs.databases.some(d => d.name === "test")) {
            const testDb = mongoose.connection.client.db("test");
            const currentDb = mongoose.connection.client.db("intellmeet");
            const testUsersCount = await testDb.collection("users").countDocuments().catch(() => 0);
            const currentUsersCount = await currentDb.collection("users").countDocuments().catch(() => 0);
            if (testUsersCount > 0 && currentUsersCount === 0) {
                console.log(`📦 Migrating ${testUsersCount} existing users from legacy database into intellmeet...`);
                for (const colName of ["users", "workspaces", "meetings", "tasks"]) {
                    const docs = await testDb.collection(colName).find({}).toArray().catch(() => []);
                    if (docs.length > 0) {
                        await currentDb.collection(colName).insertMany(docs).catch(() => {});
                    }
                }
                console.log("✅ Migration completed.");
            }
        }
    } catch (e) {
        // Non-blocking migration
    }
};

const connectDB = async () => {
    // Check all standard environment variable names used across cloud platforms
    const candidateKeys = ["MONGO_URI", "MONGODB_URI", "DATABASE_URL", "MONGO_URL"];
    let mongoUri = null;
    let selectedKey = null;

    for (const key of candidateKeys) {
        if (process.env[key] && typeof process.env[key] === "string" && !process.env[key].includes("<username>")) {
            mongoUri = process.env[key].trim();
            selectedKey = key;
            break;
        }
    }

    lastConnectionStatus.attemptedUriKey = selectedKey;
    if (mongoUri) {
        const hostMatch = mongoUri.match(/@([^/?#]+)/);
        lastConnectionStatus.sanitizedTargetHost = hostMatch ? hostMatch[1] : "configured-uri";
    }

    // 1. If explicit local flag is set, start local directly
    if (process.env.USE_LOCAL_MONGO === "true") {
        console.log("ℹ️ USE_LOCAL_MONGO is enabled. Connecting to local MongoDB...");
        const localUri = await startLocalMongo();
        await mongoose.connect(localUri, { dbName: "intellmeet" });
        await migrateLegacyData();
        lastConnectionStatus.usingFallback = true;
        console.log("✅ Connected to Local Persistent MongoDB successfully!");
        return;
    }

    // 2. Attempt connecting to configured MongoDB Atlas / Cloud database
    if (mongoUri) {
        try {
            console.log(`⏳ Connecting to MongoDB Atlas using ${selectedKey}...`);
            const conn = await mongoose.connect(mongoUri, {
                dbName: "intellmeet",
                serverSelectionTimeoutMS: 10000 // Allow up to 10s for Atlas SRV/DNS & TLS handshake
            });

            await migrateLegacyData();
            lastConnectionStatus.connectedToAtlas = true;
            lastConnectionStatus.usingFallback = false;
            lastConnectionStatus.atlasError = null;

            console.log("==========================================");
            console.log("✅ MongoDB Atlas Connected Successfully!");
            console.log(`🌐 Host: ${conn.connection.host}`);
            console.log(`📁 Database: ${conn.connection.name}`);
            console.log("🎉 User accounts, workspaces, and meetings are permanently saved in the cloud!");
            console.log("==========================================");
            return;
        } catch (err) {
            lastConnectionStatus.atlasError = err.message;
            lastConnectionStatus.connectedToAtlas = false;

            console.warn("==========================================");
            console.warn("⚠️ MongoDB Atlas connection failed:");
            console.warn(`   Error message: ${err.message}`);
            if (err.message.includes("ENOTFOUND") || err.message.includes("querySrv")) {
                console.warn("   🔍 Cause: The cluster domain does not exist in DNS.");
                console.warn("   💡 Fix: Log in to https://cloud.mongodb.com and:");
                console.warn("      1. Check if your cluster is PAUSED. If so, click 'Resume'.");
                console.warn("      2. If deleted or recreated, click 'Connect' -> 'Drivers' and copy the fresh connection string.");
            } else if (err.message.includes("Authentication failed") || err.message.includes("bad auth")) {
                console.warn("   🔍 Cause: Database username or password in connection URI is incorrect.");
                console.warn("   💡 Fix: Verify your MongoDB Atlas database user and password.");
            } else if (err.message.includes("timed out") || err.message.includes("ECONNREFUSED")) {
                console.warn("   🔍 Cause: Network connection timed out.");
                console.warn("   💡 Fix: In MongoDB Atlas -> Network Access, ensure IP Access List includes 0.0.0.0/0 (Allow access from anywhere).");
            }
            console.warn("💡 Falling back to Local Persistent MongoDB...");
            console.warn("==========================================");
        }
    } else {
        lastConnectionStatus.atlasError = "No valid cloud MongoDB URI found in environment variables (MONGO_URI or MONGODB_URI)";
    }

    // 3. Fallback to Local Persistent MongoDB so app never crashes
    try {
        lastConnectionStatus.usingFallback = true;
        const isCloudDeployment = !!(process.env.RENDER || process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.USE_LOCAL_MONGO));
        const localUri = await startLocalMongo();
        const conn = await mongoose.connect(localUri, { dbName: "intellmeet" });
        await migrateLegacyData();
        console.log("==========================================");
        console.log("✅ Connected to Local MongoDB fallback successfully!");
        console.log(`🌐 Host: ${conn.connection.host}`);
        console.log("📁 Data saved in: server/.local_mongo_data");
        if (isCloudDeployment) {
            console.warn("⚠️ IMPORTANT NOTE FOR CLOUD HOSTING (e.g. Render):");
            console.warn("   Render free-tier instances sleep after 15m and wipe ephemeral container files.");
            console.warn("   To prevent users from having to register again after server sleep,");
            console.warn("   configure MONGO_URI or MONGODB_URI in your Render service environment variables.");
        } else {
            console.log("🎉 User Login, Register, and all APIs will persist across server restarts!");
        }
        console.log("==========================================");
    } catch (fallbackErr) {
        console.error("❌ All MongoDB connection options failed:", fallbackErr.message);
    }
};

// Graceful cleanup for local mongo instance
const cleanup = async () => {
    if (localMongoInstance) {
        console.log("🛑 Stopping local MongoDB instance (preserving data)...");
        try {
            await localMongoInstance.stop({ doCleanup: false, force: true });
        } catch (e) {
            console.warn("Cleanup warning:", e.message);
        }
    }
    await mongoose.disconnect();
};

process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
});

module.exports = connectDB;
module.exports.getConnectionStatus = getConnectionStatus;