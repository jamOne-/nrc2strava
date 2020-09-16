# nrc2strava

Tool to download activities from Nike Run Club and translate them to `.gpx` format.

Gpx files contain gps locations, elevation and hearth rate.

It stores last synchronization time in `last_sync.txt` file, so in future runs it fetches only newer activities.

Soultion based on https://github.com/alexpryshchepa/nrc2strava.

## Running

```bash
npm start NIKE_BEARER_TOKEN
```

## To do

- [ ] Fetching token directly from Nike's API
- [ ] Uploading activities to Strava
- [ ] Support for pauses
