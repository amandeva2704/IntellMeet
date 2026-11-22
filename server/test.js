const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://amannit2704:AMan2704@cluster0.hdyrcai.mongodb.net/intellmeet?retryWrites=true&w=majority&appName=Cluster0"
)
.then(() => {
  console.log("Connected Successfully");
  process.exit(0);
})
.catch((err) => {
  console.log(err);
  process.exit(1);
});