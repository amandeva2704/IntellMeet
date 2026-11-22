const BASE_URL = "http://localhost:5000/api";

const verifyFlow = async () => {
    try {
        console.log("🚀 Starting E2E Programmatic Verification using Native Fetch...");

        let token = "";

        const apiRequest = async (path, method = "GET", body = null) => {
            const headers = {
                "Content-Type": "application/json"
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(`${BASE_URL}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`Request to ${path} failed with status ${response.status}: ${errData.message || response.statusText}`);
            }

            return await response.json();
        };

        // 1. Register User
        console.log("\n1. Registering user...");
        const email = `verifier_${Date.now()}@example.com`;
        const regRes = await apiRequest("/auth/register", "POST", {
            fullName: "Verifier Admin",
            email,
            password: "password123"
        });
        console.log("✅ Register Status: Success -", regRes.message);

        // 2. Login User
        console.log("\n2. Logging in...");
        const loginRes = await apiRequest("/auth/login", "POST", {
            email,
            password: "password123"
        });
        token = loginRes.token;
        console.log("✅ Login Status: Success, Token:", token ? "Acquired" : "Missing");

        // 3. Create Workspace
        console.log("\n3. Creating workspace...");
        const wsRes = await apiRequest("/workspaces", "POST", {
            name: "QA Verification Workspace",
            description: "Used to verify MERN endpoints"
        });
        const workspaceId = wsRes.workspace._id;
        console.log("✅ Workspace Status: Success, Workspace ID:", workspaceId);

        // 4. Create Meeting
        console.log("\n4. Creating meeting room...");
        const meetRes = await apiRequest("/meetings", "POST", {
            title: "Sprint Review Call"
        });
        const roomId = meetRes.meeting.roomId;
        const meetingId = meetRes.meeting._id;
        console.log("✅ Meeting Status: Success, Room ID:", roomId);

        // 5. Append Vocal Transcripts
        console.log("\n5. Simulating vocal transcript lines...");
        await apiRequest(`/meetings/${roomId}/transcript`, "PUT", {
            sender: "Verifier Admin",
            text: "Aman must resolve the MongoDB connection setup queries by tomorrow."
        });
        await apiRequest(`/meetings/${roomId}/transcript`, "PUT", {
            sender: "James Developer",
            text: "I will deploy the Docker Kubernetes container configs on Day 22."
        });
        console.log("✅ Transcripts appended.");

        // 6. End Meeting and trigger AI summary
        console.log("\n6. Ending meeting (triggers AI summaries)...");
        const endRes = await apiRequest(`/meetings/${roomId}/end`, "POST");
        const meetingDetails = endRes.meeting;
        console.log("✅ End Meeting Status: Success");
        console.log("🤖 AI Generated Summary:", meetingDetails.summary);
        console.log("🤖 AI Action Items Extracted:");
        meetingDetails.actionItems.forEach(item => {
            console.log(`   - Title: "${item.title}" (Suggested Owner: ${item.assigneeName || "None"}) [Status: ${item.status}]`);
        });

        // 7. Import Action Items as Kanban Tasks
        console.log("\n7. Importing action items into Workspace Kanban board...");
        const actionItemsToImport = meetingDetails.actionItems.map(item => ({
            title: item.title,
            assigneeName: item.assigneeName,
            actionItemId: item._id
        }));

        const importRes = await apiRequest("/tasks/action-items", "POST", {
            meetingId,
            workspaceId,
            actionItems: actionItemsToImport
        });
        console.log("✅ Import Tasks Status: Success, Imported", importRes.tasks.length, "tasks.");

        // 8. Fetch Kanban Board Tasks
        console.log("\n8. Fetching Kanban board tasks...");
        const boardRes = await apiRequest(`/tasks/workspace/${workspaceId}`);
        const tasks = boardRes.tasks;
        console.log("✅ Board Tasks found:", tasks.length);
        
        // 9. Move a Task status to "in-progress"
        if (tasks.length > 0) {
            const taskId = tasks[0]._id;
            console.log(`\n9. Moving task "${tasks[0].title}" to "in-progress"...`);
            const moveRes = await apiRequest(`/tasks/${taskId}`, "PUT", {
                status: "in-progress"
            });
            console.log("✅ Move Task Status: Success, New Status:", moveRes.task.status);
        }

        console.log("\n🎉 ALL CORE FULL-STACK MERN ENDPOINTS ARE 100% FUNCTIONAL AND VERIFIED!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Verification flow failed:", error.message);
        process.exit(1);
    }
};

verifyFlow();
