const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve User Interfaces safely from absolute path roots
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/stations.json', (req, res) => res.sendFile(path.join(__dirname, 'stations.json')));

// Expose static track data mapping safely
app.get('/railway_tracks.geojson', (req, res) => {
    const geoPath = path.join(__dirname, 'railway_tracks.geojson');
    if (fs.existsSync(geoPath)) {
        res.sendFile(geoPath);
    } else {
        res.status(404).json({ error: "railway_tracks.geojson file missing from deployment root directory." });
    }
});

let stationRegistry = {}; 
let fullTrainSchedules = {}; 

function initializeNationalNetwork() {
    try {
        console.log("🔄 Initializing Production Cloud Timetable Core...");

        const stationsPath = path.join(__dirname, 'stations.json');
        const schedulesPath = path.join(__dirname, 'schedules.json');

        if (!fs.existsSync(stationsPath) || !fs.existsSync(schedulesPath)) {
            throw new Error(`Critical dataset alignment failure. Verified paths -> Stations: ${fs.existsSync(stationsPath)}, Schedules: ${fs.existsSync(schedulesPath)}`);
        }

        // 1. Parse Stations with explicit absolute file path bindings
        const stationsData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
        (stationsData.features || []).forEach(feat => {
            if (!feat || !feat.geometry || !feat.geometry.coordinates || !feat.properties) return;
            const props = feat.properties;
            if (props.code) {
                const codeUpper = props.code.toUpperCase().trim();
                stationRegistry[codeUpper] = {
                    code: codeUpper,
                    name: props.name || "Unknown Station",
                    lat: feat.geometry.coordinates[1],
                    lng: feat.geometry.coordinates[0]
                };
            }
        });

        // 2. Parse Schedules with explicit absolute file path bindings
        const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));
        schedules.forEach(stop => {
            if (!stop.train_number || !stop.station_code) return;
            const num = stop.train_number.trim();
            
            if (!fullTrainSchedules[num]) {
                fullTrainSchedules[num] = {
                    trainNumber: num,
                    trainName: stop.train_name || `Express ${num}`,
                    stops: []
                };
            }
            
            fullTrainSchedules[num].stops.push({
                id: parseInt(stop.id) || 0,
                stationCode: stop.station_code.toUpperCase().trim(),
                stationName: stop.station_name || "Unknown Stop",
                arrival: stop.arrival && stop.arrival !== "None" ? stop.arrival : "Origin",
                departure: stop.departure && stop.departure !== "None" ? stop.departure : "Destination",
                day: parseInt(stop.day) || 1
            });
        });

        Object.keys(fullTrainSchedules).forEach(num => {
            fullTrainSchedules[num].stops.sort((a, b) => a.id - b.id);
        });

        console.log(`=======================================================`);
        console.log(` ✅ Production Grid Initialized: ${Object.keys(stationRegistry).length} Station Nodes Synced.`);
        console.log(`=======================================================`);
    } catch (err) {
        console.error("❌ Bootstrap Crash Log:", err.message);
    }
}

app.get('/api/list-stations', (req, res) => {
    const list = Object.values(stationRegistry).map(st => ({ code: st.code, name: st.name }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
});

app.get('/api/find-direct-trains', (req, res) => {
    const fromCode = (req.query.from || '').toUpperCase().trim();
    const toCode = (req.query.to || '').toUpperCase().trim();

    if (!fromCode || !toCode) {
        return res.status(400).json({ error: "Missing origin or destination selections." });
    }

    let matchingTrainsList = [];

    Object.keys(fullTrainSchedules).forEach(trainNum => {
        const train = fullTrainSchedules[trainNum];
        const srcIndex = train.stops.findIndex(s => s.stationCode === fromCode);
        const destIndex = train.stops.findIndex(s => s.stationCode === toCode);

        if (srcIndex !== -1 && destIndex !== -1 && srcIndex < destIndex) {
            const departureInfo = train.stops[srcIndex];
            const arrivalInfo = train.stops[destIndex];
            const journeyHops = train.stops.slice(srcIndex, destIndex + 1);
            
            let segmentDistanceKM = 0;
            for (let i = 0; i < journeyHops.length - 1; i++) {
                const stA = stationRegistry[journeyHops[i].stationCode];
                const stB = stationRegistry[journeyHops[i+1].stationCode];
                if (stA && stB) segmentDistanceKM += haversineDistance(stA, stB);
            }
            segmentDistanceKM = Math.round(segmentDistanceKM);
            let durationMinutes = Math.round((segmentDistanceKM / 55) * 60);

            matchingTrainsList.push({
                trainNumber: train.trainNumber,
                trainName: train.trainName,
                departureTime: departureInfo.departure,
                arrivalTime: arrivalInfo.arrival,
                runningDay: `Day ${departureInfo.day}`,
                distanceKM: segmentDistanceKM,
                durationMins: durationMinutes,
                allHaltsSequence: journeyHops
            });
        }
    });

    if (matchingTrainsList.length === 0) {
        return res.status(444).json({ error: "No connection route patterns matched." });
    }

    matchingTrainsList.sort((a, b) => a.durationMins - b.durationMins);
    res.json(matchingTrainsList);
});

function haversineDistance(s1, s2) {
    const R = 6371;
    const dLat = (s2.lat - s1.lat) * Math.PI / 180;
    const dLng = (s2.lng - s1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(s1.lat * Math.PI / 180) * Math.cos(s2.lat * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

app.listen(PORT, () => initializeNationalNetwork());
