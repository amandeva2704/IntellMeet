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

app.get("/api/db-status", (req, res) => {
    const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };
    const state = mongoose.connection.readyState;
    const host = mongoose.connection.host || "none";
    const isCloud = Boolean(host && !host.includes("127.0.0.1") && !host.includes("localhost") && host !== "none");

    res.json({
        success: true,
        connectionState: stateMap[state] || "unknown",
        readyState: state,
        host,
        databaseName: mongoose.connection.name || "none",
        isCloudAtlas: isCloud,
        isLocalFallback: !isCloud && state === 1,
        message: isCloud 
            ? "Connected to MongoDB Atlas Cloud. Data is permanently persistent."
            : "Running on temporary local database. Configure MONGO_URI in Render dashboard for permanent cloud persistence."
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