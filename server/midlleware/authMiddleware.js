const jwt = require("jsonwebtoken");
const User = require("../model/User");

const protect = async (req, res, next) => {

    let token = null;

    // Token from Authorization Header
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];
    }

    // Token from Cookie
    if (!token && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized. No token provided."
        });
    }

    try {

        const secret = process.env.JWT_SECRET || "intellmeet_secret_key";
        const decoded = jwt.verify(token, secret);

        req.user = await User.findById(decoded.id).select("-password");

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "User not found."
            });
        }

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    }
};

module.exports = protect;