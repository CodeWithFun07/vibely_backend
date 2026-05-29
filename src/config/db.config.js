import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    let connection;
    console.log("check mongo db uri --->", process.env.MONGODB_URI);
    connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
    console.log("connection or db", connection.connection.host);
    return connection;
  } catch (error) {
    console.log(error);
  }
};

export default connectDB;
