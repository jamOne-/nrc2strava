import * as nike from "./api/nike";
import * as xmlbuilder from "xmlbuilder";

interface Metadata {
  name?: string;
  desc?: string;
  time?: string;
}

interface Track {
  name?: string;
  desc?: string;
  src?: string;
  type?: number;
  trkSeg?: TrackSegment[];
}

interface TrackSegment {
  trkpt?: Waypoint[];
}

interface Waypoint {
  "@lat": number;
  "@lon": number;
  ele?: number;
  time?: string;
  extensions?: Extensions;
}

interface Extensions {
  "gpxtpx:TrackPointExtension"?: TrackPointExtension;
}

interface TrackPointExtension {
  "gpxtpx:hr"?: number;
}

interface GpxActivity {
  metadata?: Metadata;
  trk?: Track;
}

function getWeekday(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-us", { weekday: "long" });
}

export function msToISOString(ms: number): string {
  return new Date(ms).toISOString();
}

function getMetricValuesFromActivity(
  type: nike.MetricType,
  activity: nike.FullActivity
): nike.MetricValue[] {
  return activity.metrics.find((metric) => metric.type === type)?.values ?? [];
}

export function nikeActivityToGpx(activity: nike.FullActivity): GpxActivity {
  const weekday = getWeekday(activity.start_epoch_ms);
  const name = activity?.tags?.["com.nike.name"] ?? `${weekday} run (NRC)`;
  const lats = getMetricValuesFromActivity(nike.MetricType.LATITUDE, activity);
  const lons = getMetricValuesFromActivity(nike.MetricType.LONGITUDE, activity);
  const elevs = getMetricValuesFromActivity(
    nike.MetricType.ELEVATION,
    activity
  );
  const hrs = getMetricValuesFromActivity(nike.MetricType.HEART_RATE, activity);
  const adjustedHRs = adjustValuesToTimes(lats, hrs);
  const extensions = adjustedHRs.map((hr) =>
    hr ? { "gpxtpx:TrackPointExtension": { "gpxtpx:hr": hr.value } } : undefined
  );

  const points: Waypoint[] = [];
  for (let i = 0; i < lats.length; i++) {
    const currentExtensions = extensions[i];

    points.push({
      "@lat": lats[i].value,
      "@lon": lons[i].value,
      ele: elevs[i].value,
      time: msToISOString((lats[i].start_epoch_ms + lats[i].end_epoch_ms) / 2),
      ...(currentExtensions && { extensions: currentExtensions }),
    });
  }

  const gpx: GpxActivity = {
    metadata: {
      name,
      time: msToISOString(activity.start_epoch_ms),
    },
    trk: {
      name,
      type: 9,
      // TODO: Below doesn't work :(
      // src: "Apple Watch Series 4",
      trkSeg: [{ trkpt: points }],
    },
  };

  return gpx;
}

function adjustValuesToTimes(
  base: nike.MetricValue[],
  values: nike.MetricValue[]
): Array<nike.MetricValue | undefined> {
  const length = base.length;
  const timeWindows: nike.Timed[] = [
    {
      start_epoch_ms: 0,
      end_epoch_ms: (base[0].end_epoch_ms + base[1].start_epoch_ms) / 2,
    },
  ];
  for (let i = 1; i < length - 1; i++) {
    const start_epoch_ms =
      (base[i - 1].end_epoch_ms + base[i].start_epoch_ms) / 2;
    const end_epoch_ms =
      (base[i].end_epoch_ms + base[i + 1].start_epoch_ms) / 2;
    timeWindows.push({ start_epoch_ms, end_epoch_ms });
  }
  timeWindows.push({
    start_epoch_ms:
      (base[length - 2].end_epoch_ms + base[length - 1].start_epoch_ms) / 2,
    end_epoch_ms: Number.MAX_VALUE,
  });

  const ret: Array<nike.MetricValue | undefined> = [];
  let v_index = 0;

  for (const window of timeWindows) {
    const currentValues: nike.MetricValue[] = [];

    while (
      v_index < values.length &&
      values[v_index].start_epoch_ms >= window.start_epoch_ms &&
      values[v_index].end_epoch_ms < window.end_epoch_ms
    ) {
      currentValues.push(values[v_index]);
      v_index++;
    }

    if (currentValues.length > 0) {
      ret.push({
        start_epoch_ms: average(currentValues.map((v) => v.start_epoch_ms)),
        end_epoch_ms: average(currentValues.map((v) => v.end_epoch_ms)),
        value: Math.round(average(currentValues.map((v) => v.value))),
      });
    } else {
      ret.push(undefined);
    }
  }

  return ret;
}

function average(xs: number[]): number {
  return xs.reduce((sum, x) => sum + x) / xs.length;
}

export function gpxActivityToXml(gpx: GpxActivity): string {
  const gpxWithAnnotations: any = {
    gpx: {
      "@creator": "github.com/jamone-/nrc2strava",
      "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@xsi:schemaLocation":
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd",
      "@version": "1.1",
      "@xmlns": "http://www.topografix.com/GPX/1/1",
      "@xmlns:gpxtpx":
        "http://www.garmin.com/xmlschemas/TrackPointExtension/v1",
      "@xmlns:gpxx": "http://www.garmin.com/xmlschemas/GpxExtensions/v3",
      ...gpx,
    },
  };

  return xmlbuilder
    .create(gpxWithAnnotations, { encoding: "UTF-8" })
    .end({ pretty: true });
}
