/**
 * A test inbox for the mail features, so an email can be proven to arrive
 * without a verified sending domain and without the school's real inbox.
 *
 *   node scripts/mail-trap.mjs            # listens, prints what it receives
 *   node scripts/mail-trap.mjs --port 1025
 *
 * Then in .env.local:
 *
 *   SMTP_HOST="127.0.0.1"
 *   SMTP_PORT="1025"
 *   SMTP_SECURE="0"
 *
 * and every ticket the store sends is caught here instead of leaving the
 * machine. No authentication is accepted and none is needed.
 *
 * This is a *developer* tool: it proves the app builds and sends the right
 * message (recipients, subject, inline QR, artwork attachment) and never touches
 * a real mailbox. To prove delivery to a real inbox you need a real provider —
 * see TICKETS.md.
 *
 * Plain SMTP is a small enough protocol to read in one sitting, and doing so
 * keeps nodemailer's `streamTransport`/`jsonTransport` out of the test path: the
 * app is exercised over a socket exactly as it would be against Gmail.
 */
import net from "node:net";

const port = Number(
  process.argv.includes("--port")
    ? process.argv[process.argv.indexOf("--port") + 1]
    : process.env.MAIL_TRAP_PORT ?? 1025
);

const connections = new Set();
let received = 0;

const server = net.createServer((socket) => {
  connections.add(socket);
  socket.setEncoding("utf8");

  let buffer = "";
  let inData = false;
  const message = { from: "", to: [], data: [] };

  const say = (line) => socket.write(line + "\r\n");

  say("220 mail-trap ready");

  socket.on("data", (chunk) => {
    buffer += chunk;

    for (;;) {
      if (inData) {
        // DATA ends with CRLF.CRLF on a line of its own.
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) break;
        message.data.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 5);
        inData = false;
        report(message);
        message.from = "";
        message.to = [];
        message.data = [];
        say("250 2.0.0 Ok: queued");
        continue;
      }

      const nl = buffer.indexOf("\r\n");
      if (nl === -1) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const verb = line.slice(0, 4).toUpperCase();

      if (verb === "EHLO" || verb === "HELO") {
        // No STARTTLS and no AUTH advertised: the app falls back to none.
        say("250-mail-trap");
        say("250 8BITMIME");
      } else if (verb === "MAIL") {
        message.from = line.replace(/^MAIL FROM:\s*/i, "").trim();
        say("250 2.1.0 Ok");
      } else if (verb === "RCPT") {
        message.to.push(line.replace(/^RCPT TO:\s*/i, "").trim());
        say("250 2.1.5 Ok");
      } else if (verb === "DATA") {
        inData = true;
        say("354 End data with <CR><LF>.<CR><LF>");
      } else if (verb === "RSET") {
        say("250 2.0.0 Ok");
      } else if (verb === "NOOP") {
        say("250 2.0.0 Ok");
      } else if (verb === "QUIT") {
        say("221 2.0.0 Bye");
        socket.end();
      } else {
        say("502 5.5.2 Command not implemented");
      }
    }
  });

  socket.on("error", () => connections.delete(socket));
  socket.on("close", () => connections.delete(socket));
});

/** Prints the parts of the message that actually matter, not the whole body. */
function report(msg) {
  received++;
  const raw = msg.data.join("\r\n");
  const header = (name) => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.*(?:\\r\\n[ \\t].*)*)`, "im"));
    return m ? m[1].replace(/\r\n[ \t]+/g, " ").trim() : "";
  };

  const parts = [...raw.matchAll(/Content-Type:\s*([^;\r\n]+)/gi)].map((m) => m[1].trim());
  const attachments = [...raw.matchAll(/Content-Disposition:\s*attachment;\s*filename="?([^"\r\n;]+)"?/gi)].map(
    (m) => m[1]
  );
  const inlineIds = [...raw.matchAll(/Content-ID:\s*<?([^>\r\n]+)>?/gi)].map((m) => m[1]);

  const lines = [
    "",
    `────────────────── message ${received} ──────────────────`,
    `  from     ${msg.from}`,
    `  to       ${msg.to.join(", ")}`,
    `  subject  ${header("Subject")}`,
    `  parts    ${parts.join(" · ") || "none"}`,
  ];
  if (inlineIds.length) lines.push(`  inline   ${inlineIds.join(", ")}`);
  if (attachments.length) lines.push(`  attached ${attachments.join(", ")}`);
  lines.push(`  size     ${(raw.length / 1024).toFixed(1)} kB`);
  lines.push(`─────────────────────────────────────────────────────`);
  console.log(lines.join("\n"));
}

server.listen(port, "0.0.0.0", () => {
  console.log(`mail-trap listening on 0.0.0.0:${port}`);
  console.log(`point .env.local at it:  SMTP_HOST="127.0.0.1"  SMTP_PORT="${port}"  SMTP_SECURE="0"`);
  console.log("ctrl-c to stop\n");
});

const shutdown = () => {
  for (const s of connections) s.destroy();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
