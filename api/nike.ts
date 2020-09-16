import fetch from "node-fetch";

export type BearerToken = string;
export type Id = string;

export interface Timed {
  end_epoch_ms: number;
  start_epoch_ms: number;
}

export interface Activity extends Timed {
  id: Id;
  type: string;
  metrics?: Metric[];
  metric_types: MetricType[];
  tags?: Tags;
}

export interface MetricValue extends Timed {
  value: number;
}

export interface Metric {
  type: MetricType;
  values: MetricValue[];
}

export interface FullActivity extends Activity {
  metrics: Metric[];
}

export enum MetricType {
  ELEVATION = "elevation",
  LATITUDE = "latitude",
  LONGITUDE = "longitude",
  HEART_RATE = "heart_rate",
}

interface Paging {
  after_time: number;
  after_id: number;
}

interface ActivitiesResult {
  activities: Activity[];
  paging: Paging;
}

export interface Tags {
  "com.nike.name"?: string;
  "com.nike.temperature"?: string;
  "com.nike.weather"?: string;
}

async function fetchWithToken<T>(token: BearerToken, url: string): Promise<T> {
  const result = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (result.ok) {
    return result.json();
  }

  throw new Error("Something went wrong");
}

export function getToken(): BearerToken {
  // TODO
  return "";
}

export async function getRunningActivitiesIdsAfterTime(
  token: BearerToken,
  afterTime: number = 0,
  ids: Id[] = []
): Promise<Id[]> {
  const { activities, paging } = await getActivitiesAfterTime(token, afterTime);
  ids.push(...activities.filter(isRunningWithGPSActivity).map(({ id }) => id));

  if (paging.after_time === undefined) {
    return ids;
  }

  return getRunningActivitiesIdsAfterTime(token, paging.after_time, ids);
}

export function getActivitiesAfterTime(
  token: BearerToken,
  afterTime: number = 0
): Promise<ActivitiesResult> {
  const url = `https://api.nike.com/sport/v3/me/activities/after_time/${afterTime}`;
  return fetchWithToken<ActivitiesResult>(token, url);
}

export function getActivityById(
  token: BearerToken,
  id: Id
): Promise<FullActivity> {
  const url = `https://api.nike.com/sport/v3/me/activity/${id}?metrics=ALL`;
  return fetchWithToken<FullActivity>(token, url);
}

export function isRunningWithGPSActivity(activity: Activity): boolean {
  return (
    activity.type === "run" &&
    activity.metric_types.includes(MetricType.LATITUDE) &&
    activity.metric_types.includes(MetricType.LONGITUDE)
  );
}
