const Workspace = require("../model/Workspace");
const User = require("../model/User");

exports.createWorkspace = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Workspace name is required"
            });
        }

        const workspace = await Workspace.create({
            name,
            description,
            owner: req.user._id,
            members: [req.user._id]
        });

        const populatedWorkspace = await Workspace.findById(workspace._id)
            .populate("owner", "fullName email avatar")
            .populate("members", "fullName email avatar");

        res.status(201).json({
            success: true,
            workspace: populatedWorkspace
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getWorkspaces = async (req, res) => {
    try {
        const workspaces = await Workspace.find({
            members: req.user._id
        })
        .populate("owner", "fullName email avatar")
        .populate("members", "fullName email avatar")
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            workspaces
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.inviteMember = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "User email is required to invite"
            });
        }

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }

        // Only owner can invite
        if (workspace.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only workspace owner can invite members"
            });
        }

        const invitedUser = await User.findOne({ email });
        if (!invitedUser) {
            return res.status(404).json({
                success: false,
                message: "No user found with this email"
            });
        }

        if (workspace.members.includes(invitedUser._id)) {
            return res.status(400).json({
                success: false,
                message: "User is already a member of this workspace"
            });
        }

        workspace.members.push(invitedUser._id);
        await workspace.save();

        const updatedWorkspace = await Workspace.findById(workspaceId)
            .populate("owner", "fullName email avatar")
            .populate("members", "fullName email avatar");

        res.status(200).json({
            success: true,
            workspace: updatedWorkspace,
            message: `User ${invitedUser.fullName} added successfully`
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getWorkspaceDetails = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const workspace = await Workspace.findById(workspaceId)
            .populate("owner", "fullName email avatar")
            .populate("members", "fullName email avatar");

        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }

        // Check if user is member
        if (!workspace.members.some(m => m._id.toString() === req.user._id.toString())) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You are not a member of this workspace"
            });
        }

        res.status(200).json({
            success: true,
            workspace
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
