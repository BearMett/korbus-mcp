-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "stationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "alertMinutes" INTEGER NOT NULL DEFAULT 5,
    "type" TEXT NOT NULL DEFAULT 'RECURRING',
    "activeUntil" DATETIME,
    "firedAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alarm_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alarm_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Alarm" ("alertMinutes", "createdAt", "enabled", "id", "label", "routeId", "stationId") SELECT "alertMinutes", "createdAt", "enabled", "id", "label", "routeId", "stationId" FROM "Alarm";
DROP TABLE "Alarm";
ALTER TABLE "new_Alarm" RENAME TO "Alarm";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
