import mongoose from "mongoose";

const connectDB = async () => {
  try {
    let connection;
    connection = await mongoose.connect(process.env.MONGODB_URI);
    return connection;
  } catch (error) {
    console.log(error);
  }
};

export default connectDB;
