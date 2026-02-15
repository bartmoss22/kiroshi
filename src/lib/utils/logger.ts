import { createLogger, format, transports } from "winston";

const logger = createLogger({
    level: "info",
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message, label, timestamp }) => {
            const lbl = label || "unlabeled";
            return `${timestamp} [${lbl}] ${level}: ${message}`;
        })
    ),
    transports: [new transports.Console()],
});

export default logger;