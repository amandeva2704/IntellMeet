/**
 * Sync Local MongoDB Data to Remote MongoDB Atlas
 * Usage: node server/scripts/sync-local-to-atlas.js "<YOUR_ATLAS_MONGO_URI>"
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const targetUri = process.argv[2] || process.env.TARGET_MONGO_URI;

if (!targetUri) {
    console.error("❌ Please provide the target MongoDB Atlas URI as an argument:");
    console.error("   node server/scripts/sync-local-to-atlas.js \"mongodb+srv://user:pass@cluster.mongodb.net/intellmeet?retryWrites=true&w=majority\"");
    process.exit(1);
}

const syncData = async () => {
    let localMongo = null;
    let localConn = null;
    let targetConn = null;

    try {
        console.log("==================================================");
        console.log("🔄 INTELLMEET DATABASE SYNC: LOCAL -> CLOUD ATLAS");
        console.log("==================================================");

        // 1. Connect to Local MongoDB
        console.log("📦 Connecting to local database...");
        const { MongoMemoryServer } = require("mongodb-memory-server");
        const dbPath = path.resolve(__dirname, "..", ".local_mongo_data");

        if (!fs.existsSync(dbPath)) {
            console.error("❌ Local data folder server/.local_mongo_data does not exist!");
            process.exit(1);
        }

        localMongo = await MongoMemoryServer.create({
            instance: {
                dbPath,
                storageEngine: "wiredTiger",
                dbName: "intellmeet"
            }
        });

        const localUri = localMongo.getUri("intellmeet");
        localConn = await mongoose.createConnection(localUri, { dbName: "intellmeet" }).asPromise();
        console.log("✅ Connected to local database.");

        // 2. Connect to Remote MongoDB Atlas
        console.log("🌐 Connecting to target MongoDB Atlas...");
        targetConn = await mongoose.createConnection(targetUri, {
            serverSelectionTimeoutMS: 15000,
            dbName: "intellmeet"
        }).asPromise();
        console.log("✅ Connected to MongoDB Atlas successfully!");

        // 3. Collections to sync
        const collections = ["users", "workspaces", "meetings", "tasks"];

        for (const colName of collections) {
            const localCollection = localConn.collection(colName);
            const targetCollection = targetConn.collection(colName);

            const items = await localCollection.find({}).toArray();
            console.log(`\n📋 Processing collection "${colName}": ${items.length} items found locally.`);

            if (items.length === 0) continue;

            let inserted = 0;
            let updated = 0;

            for (const item of items) {
                // Upsert by _id so existing items are preserved without duplicate errors
                const res = await targetCollection.replaceOne(
                    { _id: item._id },
                    item,
                    { upsert: true }
                );

                if (res.upsertedCount > 0) {
                    inserted++;
                } else if (res.modifiedCount > 0 || res.matchedCount > 0) {
                    updated++;
                }
            }

            console.log(`   ✨ Synced "${colName}": ${inserted} inserted, ${updated} matched/updated.`);
        }

        console.log("\n==================================================");
        console.log("🎉 ALL USERS AND DATA SUCCESSFULLY SYNCED TO ATLAS!");
        console.log("   You can now log in permanently on Vercel with your existing credentials.");
        console.log("==================================================");

    } catch (err) {
        console.error("❌ Sync failed:", err.message);
    } finally {
        if (localConn) await localConn.close().catch(() => {});
        if (targetConn) await targetConn.close().catch(() => {});
        if (localMongo) await localMongo.stop({ doCleanup: false, force: true }).catch(() => {});
        process.exit(0);
    }
};

syncData();
