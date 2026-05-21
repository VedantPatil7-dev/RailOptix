const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
// Change this line: const PORT = 3000;
// To this production-safe version:
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, 'index.html')));
app.get('/stations.json', (req, res) => res.sendFile(path.resolve(__dirname, 'stations.json')));

let stationRegistry = {}; 
let fullTrainSchedules = {}; 
let stationToTrainsMap = {}; // Tracks which trains pass through each station for quick junction matching

function initializeNationalNetwork() {
    try {
        console.log("🔄 Initializing Multi-Hop Timetable Core Database...");

        if (!fs.existsSync(path.join(__dirname, 'stations.json')) || !fs.existsSync(path.join(__dirname, 'schedules.json'))) {
            throw new Error("Missing dataset files in folder root workspace.");
        }

        // 1. Map All Stations
        const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf8'));
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
                stationToTrainsMap[codeUpper] = new Set();
            }
        });

        // 2. Parse and Compile All Available Train Timetables
        const schedules = JSON.parse(fs.readFileSync(path.join(__dirname, 'schedules.json'), 'utf8'));
        
        schedules.forEach(stop => {
            if (!stop.train_number || !stop.station_code) return;
            const num = stop.train_number.trim();
            const stCode = stop.station_code.toUpperCase().trim();
            
            if (!fullTrainSchedules[num]) {
                fullTrainSchedules[num] = {
                    trainNumber: num,
                    trainName: stop.train_name || `Express ${num}`,
                    stops: []
                };
            }
            
            fullTrainSchedules[num].stops.push({
                id: parseInt(stop.id) || 0,
                stationCode: stCode,
                stationName: stop.station_name || "Unknown Stop",
                arrival: stop.arrival && stop.arrival !== "None" ? stop.arrival : "Origin",
                departure: stop.departure && stop.departure !== "None" ? stop.departure : "Destination",
                day: parseInt(stop.day) || 1
            });

            if (stationToTrainsMap[stCode]) {
                stationToTrainsMap[stCode].add(num);
            }
        });

        Object.keys(fullTrainSchedules).forEach(num => {
            fullTrainSchedules[num].stops.sort((a, b) => a.id - b.id);
        });

        console.log(`=======================================================`);
        console.log(` ✅ Multi-Hop Core Ready: ${Object.keys(fullTrainSchedules).length} Trains Synced.`);
        console.log(`=======================================================`);
    } catch (err) {
        console.error("❌ Critical System Halt during initialization:", err.message);
    }
}

app.get('/api/list-stations', (req, res) => {
    const list = Object.values(stationRegistry).map(st => ({ code: st.code, name: st.name }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
});

// ============================================================================
// NEW ADVANCED TWO-TIER JUNCTION-HOPPING ROUTER
// ============================================================================
app.get('/api/find-direct-trains', (req, res) => {
    const fromCode = (req.query.from || '').toUpperCase().trim();
    const toCode = (req.query.to || '').toUpperCase().trim();

    if (!fromCode || !toCode) {
        return res.status(400).json({ error: "Missing origin or destination selections." });
    }

    let solutions = [];

    // TIER 1: Find Direct Trains
    Object.keys(fullTrainSchedules).forEach(trainNum => {
        const train = fullTrainSchedules[trainNum];
        const srcIdx = train.stops.findIndex(s => s.stationCode === fromCode);
        const destIdx = train.stops.findIndex(s => s.stationCode === toCode);

        if (srcIdx !== -1 && destIdx !== -1 && srcIdx < destIdx) {
            solutions.push(buildSegmentPayload(train, srcIdx, destIdx, "Direct Connection"));
        }
    });

    // TIER 2: If no direct trains, compute Junction Transfers (1-Hop Intersect)
    if (solutions.length === 0) {
        const sourceTrains = Array.from(stationToTrainsMap[fromCode] || []);
        const destTrains = Array.from(stationToTrainsMap[toCode] || []);

        let possibleJunctions = [];

        // Find intersecting stations between source train sets and destination train sets
        sourceTrains.forEach(sTrainNum => {
            const sTrainStops = fullTrainSchedules[sTrainNum].stops;
            const sSrcIdx = sTrainStops.findIndex(s => s.stationCode === fromCode);
            
            // Look forward along the remainder of this train's path
            for(let i = sSrcIdx + 1; i < sTrainStops.length; i++) {
                const intermediateJunction = sTrainStops[i].stationCode;
                
                // See if any destination train stops at this same intermediate station
                destTrains.forEach(dTrainNum => {
                    if (sTrainNum === dTrainNum) return; // Must be a transfer between different trains
                    
                    const dTrainStops = fullTrainSchedules[dTrainNum].stops;
                    const dJuncIdx = dTrainStops.findIndex(s => s.stationCode === intermediateJunction);
                    const dDestIdx = dTrainStops.findIndex(s => s.stationCode === toCode);

                    if (dJuncIdx !== -1 && dDestIdx !== -1 && dJuncIdx < dDestIdx) {
                        possibleJunctions.push({
                            junctionCode: intermediateJunction,
                            train1: sTrainNum,
                            t1SrcIdx: sSrcIdx,
                            t1JuncIdx: i,
                            train2: dTrainNum,
                            t2JuncIdx: dJuncIdx,
                            t2DestIdx: dDestIdx
                        });
                    }
                });
            }
        });

        // Compile and format the valid junction-hop options found
        possibleJunctions.slice(0, 5).forEach(junc => {
            const segment1 = buildSegmentPayload(fullTrainSchedules[junc.train1], junc.t1SrcIdx, junc.t1JuncIdx, "Leg 1");
            const segment2 = buildSegmentPayload(fullTrainSchedules[junc.train2], junc.t2JuncIdx, junc.t2DestIdx, "Leg 2");

            solutions.push({
                isMultiHop: true,
                junctionName: stationRegistry[junc.junctionCode]?.name || junc.junctionCode,
                junctionCode: junc.junctionCode,
                trainNumber: `${segment1.trainNumber} ➔ ${segment2.trainNumber}`,
                trainName: `${segment1.trainName} mixed with ${segment2.trainName}`,
                departureTime: segment1.departureTime,
                arrivalTime: segment2.arrivalTime,
                runningDay: segment1.runningDay,
                distanceKM: segment1.distanceKM + segment2.distanceKM,
                durationMins: segment1.durationMins + segment2.durationMins + 45, // includes 45-min buffer layover
                leg1Halts: segment1.allHaltsSequence,
                leg2Halts: segment2.allHaltsSequence
            });
        });
    }

    if (solutions.length === 0) {
        return res.status(444).json({ error: "No direct or 1-hop junction connections found." });
    }

    solutions.sort((a, b) => a.durationMins - b.durationMins);
    res.json(solutions);
});

function buildSegmentPayload(train, startIdx, endIdx, typeLabel) {
    const journeyHops = train.stops.slice(startIdx, endIdx + 1);
    let dist = 0;
    for (let i = 0; i < journeyHops.length - 1; i++) {
        const stA = stationRegistry[journeyHops[i].stationCode];
        const stB = stationRegistry[journeyHops[i+1].stationCode];
        if (stA && stB) dist += haversine(stA, stB);
    }
    dist = Math.round(dist);
    return {
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        departureTime: train.stops[startIdx].departure,
        arrivalTime: train.stops[endIdx].arrival,
        runningDay: `Day ${train.stops[startIdx].day}`,
        distanceKM: dist,
        durationMins: Math.round((dist / 55) * 60),
        allHaltsSequence: journeyHops
    };
}

function haversine(s1, s2) {
    const R = 6371;
    const dLat = (s2.lat - s1.lat) * Math.PI / 180;
    const dLng = (s2.lng - s1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(s1.lat * Math.PI / 180) * Math.cos(s2.lat * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

app.listen(PORT, () => initializeNationalNetwork());