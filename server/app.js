const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const taskRoutes = require("./routes/taskRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");

const app = express();

app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "Welcome to IntellMeet API"
    });

});


module.exports = app;