import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  username: process.env.REDIS_NAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

await client.connect();

export default client;
