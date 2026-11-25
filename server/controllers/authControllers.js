const User = require("../model/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Check if database is connected
const checkDBReady = (res) => {
    if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
            success: false,
            message: "Database is connecting. Please try again in a few seconds."
        });
        return false;
    }
    return true;
};

// Register
exports.register = async (req, res) => {
    try {
        if (!checkDBReady(res)) return;

        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide fullName, email, and password."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Check if user exists with exact or case-insensitive email
        const userExists = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } }
            ]
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        const userResponse = user.toObject();
        delete userResponse.password;

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || "intellmeet_secret_key",
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax"
        });

        res.status(201).json({
            success: true,
            message: "User Registered Successfully",
            user: userResponse,
            token
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to register user"
        });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        if (!checkDBReady(res)) return;

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide both email and password."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Primary lookup: Exact match on normalized email
        let user = await User.findOne({ email: normalizedEmail }).select("+password");

        // 2. Secondary lookup: Case-insensitive regex match (for legacy accounts registered before strict lowercase normalization)
        if (!user) {
            const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            user = await User.findOne({
                email: { $regex: new RegExp(`^${escapedEmail}$`, "i") }
            }).select("+password");

            // Auto-heal legacy user record to normalized lowercase email
            if (user && user.email !== normalizedEmail) {
                user.email = normalizedEmail;
                await user.save().catch(console.warn);
            }
        }

        // 3. Tertiary lookup: Check if user exists in legacy 'test' database on the same MongoDB connection
        if (!user && mongoose.connection.readyState === 1) {
            try {
                const currentDbName = mongoose.connection.name;
                if (currentDbName !== "test") {
                    const testDb = mongoose.connection.client.db("test");
                    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const legacyUserDoc = await testDb.collection("users").findOne({
                        $or: [
                            { email: normalizedEmail },
                            { email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } }
                        ]
                    });

                    if (legacyUserDoc) {
                        console.log(`📦 Auto-migrating legacy user "${normalizedEmail}" from 'test' database into '${currentDbName}'...`);
                        legacyUserDoc.email = normalizedEmail;
                        await mongoose.connection.db.collection("users").insertOne(legacyUserDoc).catch(() => {});
                        user = await User.findOne({ email: normalizedEmail }).select("+password");
                    }
                }
            } catch (legacyErr) {
                console.warn("Legacy database user fallback notice:", legacyErr.message);
            }
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found with this email"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || "intellmeet_secret_key",
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax"
        });

        const userObj = user.toObject();
        delete userObj.password;

        res.json({
            success: true,
            token,
            user: userObj
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to log in"
        });
    }
};

// Logout
exports.logout = (req, res) => {
    res.clearCookie("token");
    res.json({
        success: true,
        message: "Logged Out Successfully"
    });
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized"
            });
        }
        res.status(200).json({
            success: true,
            user: req.user
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};