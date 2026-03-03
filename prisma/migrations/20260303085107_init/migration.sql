-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "arsId" TEXT,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "posX" REAL,
    "posY" REAL
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "stationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "alertMinutes" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alarm_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alarm_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlarmSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alarmId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "AlarmSchedule_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlarmChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alarmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "AlarmChannel_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alarmId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NotificationLog_alarmId_vehicleId_sentAt_idx" ON "NotificationLog"("alarmId", "vehicleId", "sentAt");
