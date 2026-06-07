const mongoose = require("mongoose");

const connectDB = async () => {
  try {
<<<<<<< HEAD
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/finghit";

    await mongoose.connect(mongoUri);
=======
    await mongoose.connect(process.env.MONGO_URI);
>>>>>>> 429c3000c8f8f281b7a5e6da5ecb519c26994ba6
    console.log("MongoDB Connected");
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

module.exports = connectDB;