
import "dotenv/config";
import { ZKTecoClient } from "@graphland/zkteco";

const ip = process.env.ZK_DEVICE_IP;
const port = Number(process.env.ZK_DEVICE_PORT ?? 4370);

if (!ip) {
  throw new Error("Missing ZK_DEVICE_IP in .env");
}

const client = new ZKTecoClient({
  ip,
  port,
  timeout: 10000,
  commKey: 0,
});

async function main() {
  let connected = false;

  try {
    console.log(`Connecting to uFace800 at ${ip}:${port}...`);

    await client.connect();
    connected = true;
    console.log("Connected successfully!");

    console.log("\nReading device information...");
    const info = await client.getInfo();
    console.log("Device information:", info);

    console.log("\nReading attendance logs...");
    const logs = await client.getAttendances();

    console.log("Total attendance records:", logs.length);
    console.log("First 3 records:", logs.slice(0, 3));
  } catch (error: unknown) {
    console.error("ZKTeco test failed:");

    if (error instanceof Error) {
      console.error(error.stack ?? error.message);
    } else {
      console.dir(error, { depth: 5 });
    }
  } finally {
    if (connected) {
      try {
        await client.disconnect();
        console.log("\nDisconnected successfully.");
      } catch (error) {
        console.error("Disconnect failed:", error);
      }
    }
  }
}

main().catch(console.error);
