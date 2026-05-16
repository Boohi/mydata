// Known-bad fixture: tries to open an outbound TCP connection.
// In an isolated network namespace this MUST fail.
import net from "node:net";

const socket = net.createConnection({ host: "1.1.1.1", port: 80 });
socket.on("connect", () => {
  console.log("CONNECTED");
  socket.end();
  process.exit(0);
});
socket.on("error", (err) => {
  console.error("ERROR:", err.code);
  process.exit(2);
});
setTimeout(() => {
  console.error("TIMEOUT");
  process.exit(3);
}, 3000);
