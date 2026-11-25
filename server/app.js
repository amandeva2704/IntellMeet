const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const taskRoutes = require("./routes/taskRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

app.use(helmet());

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://intell-meet-virid.vercel.app"
];

if (process.env.CLIENT_URL) {
    const customOrigins = process.env.CLIENT_URL.split(",").map(u => u.trim());
    allowedOrigins.push(...customOrigins);
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.includes(origin) ||
                          origin.endsWith(".vercel.app") ||
                          /^https?:\/\/localhost(:\d+)?$/.test(origin);

        if (isAllowed) {
            return callback(null, origin);
        }

        // Echo origin to avoid breaking cross-origin requests from preview deployments
        return callback(null, origin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

const mongoose = require("mongoose");

app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/analytics", analyticsRoutes);

const { getConnectionStatus } = require("./config/db");

app.get("/api/db-status", async (req, res) => {
    const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };
    const state = mongoose.connection.readyState;
    const host = mongoose.connection.host || "none";
    const isCloud = Boolean(host && !host.includes("127.0.0.1") && !host.includes("localhost") && host !== "none");

    let usersCount = 0;
    let registeredEmails = [];
    try {
        if (state === 1) {
            usersCount = await mongoose.connection.db.collection("users").countDocuments();
            const sample = await mongoose.connection.db.collection("users").find({}, { projection: { email: 1 } }).limit(20).toArray();
            registeredEmails = sample.map(u => u.email);
        }
    } catch (e) {}

    const connStatus = getConnectionStatus ? getConnectionStatus() : {};

    res.json({
        success: true,
        connectionState: stateMap[state] || "unknown",
        readyState: state,
        host,
        databaseName: mongoose.connection.name || "none",
        isCloudAtlas: isCloud,
        isLocalFallback: !isCloud && state === 1,
        usersCount,
        registeredEmails,
        diagnostics: {
            configuredEnvKeys: {
                MONGO_URI: Boolean(process.env.MONGO_URI),
                MONGODB_URI: Boolean(process.env.MONGODB_URI),
                DATABASE_URL: Boolean(process.env.DATABASE_URL),
                MONGO_URL: Boolean(process.env.MONGO_URL),
                JWT_SECRET: Boolean(process.env.JWT_SECRET)
            },
            attemptedEnvKey: connStatus.attemptedUriKey || null,
            targetHost: connStatus.sanitizedTargetHost || null,
            atlasError: connStatus.atlasError || null
        },
        message: isCloud 
            ? "Connected to MongoDB Atlas Cloud. Data is permanently persistent."
            : "Running on temporary local database. User accounts will be lost when Render restarts unless a working MONGO_URI/MONGODB_URI is configured."
    });
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to IntellMeet API",
        dbStatus: "/api/db-status"
    });
});


module.exports = app;