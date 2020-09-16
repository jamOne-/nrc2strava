import * as fs from "fs";
import * as nike from "./api/nike";
import { nikeActivityToGpx, gpxActivityToXml, msToISOString } from "./helpers";

const LAST_SYNC_PATH = `${__dirname}/last_sync.txt`;
const NIKE_BEARER = process.argv[2];

function getLastSyncMs(): number {
  if (fs.existsSync(LAST_SYNC_PATH)) {
    const lastSyncString = fs.readFileSync(LAST_SYNC_PATH, {
      encoding: "utf-8",
    });
    return Number.parseInt(lastSyncString) || 0;
  } else {
    return 0;
  }
}

async function main() {
  const activitiesIds = await nike.getRunningActivitiesIdsAfterTime(
    NIKE_BEARER,
    getLastSyncMs()
  );

  console.log(`got ${activitiesIds.length} ids`);

  const activities = await Promise.all(
    activitiesIds.map((id) => nike.getActivityById(NIKE_BEARER, id))
  );

  console.log("all fetched");

  for (const activity of activities) {
    const gpx = nikeActivityToGpx(activity);
    const xml = gpxActivityToXml(gpx);
    const activityDate = msToISOString(activity.start_epoch_ms).replace(
      /:/g,
      ";"
    );

    fs.writeFileSync(
      `${__dirname}/activities/${activityDate}_${activity.id}.gpx`,
      xml
    );
  }

  const now = Date.now();
  fs.writeFileSync(LAST_SYNC_PATH, now.toString());
}

main();
