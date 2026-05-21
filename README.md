The Implementation Roadmap: From Simple to Complex

Phase 1: Creating Stations (Vertices) — Simple
Before we connect anything, we need to create individual stations.
The Goal: Write a function that takes a station name (e.g., "Bhusawal") and inserts it into our array of stations.
Syllabus Focus: Basic Structures (struct), string copying (strcpy), and standard array indexing.
Testing Benchmark: You can add 3 stations and print their names to the console to confirm they are stored correctly.

Phase 2: Connecting Stations with Tracks (Edges) — Intermediate
Now we connect those stations using a Linked List format to represent tracks.
The Goal: Write an addTrack() function. If you connect "Bhusawal" to "Pune", the code must dynamically allocate a StationEdge structure using malloc(), set the distance/travel time, and attach it to Bhusawal’s headEdge pointer.
Syllabus Focus: Pointers, Dynamic Memory Allocation (DMA), and Linked List insertion logic.
Testing Benchmark: A "Display Network" function that prints out:
Bhusawal ---> Connected to: Pune (450 KM) ---> Connected to: Mumbai (420 KM)

Phase 3: Dynamic Network Scaling — Intermediate
What happens if your railway network grows from 5 stations to 50? Fixed arrays will fail or waste RAM.
The Goal: When the station array becomes full, use realloc() to automatically double the memory capacity of your network without losing existing station data.
Syllabus Focus: Advanced DMA (realloc) and memory safety management.
Testing Benchmark: Initialize your capacity to 2 stations, add 5 stations, and verify that the program scales dynamically without crashing or throwing a Segmentation Fault.

Phase 4: Interactive Command-Line Menu — Intermediate
Give your system a clean, user-friendly interface.
The Goal: Create a continuous loop menu using a switch-case block.
The Menu Options:
Add New Railway Station
Add/Connect Track Between Stations
Update Track Congestion Status (toggle if a track is delayed)
View Complete Network Topology Map
Find Shortest Route (Placeholder for now)
Exit System
Testing Benchmark: Ensure the user can easily navigate the application and that inputs are safely handled without infinite loops.

Phase 5: The Routing Engine (Dijkstra's Algorithm) — Complex
This is the heart of your project and where your Graph Theory knowledge comes alive.
The Goal: Write the pathfinding function. It will take a starting station and an ending station, calculate the shortest cumulative distance, factor in track congestion penalties, and print out the precise step-by-step route.
Syllabus Focus: Graph Traversals, Shortest Path Optimization, and multi-pointer tracking arrays.
Testing Benchmark: Pass "Bhusawal" and "Pune" into the function and have it output the exact sequence of stations to traverse along with the total optimal distance.

Phase 6: Database Persistence — Complex
A real system cannot lose all its data every time you close the program.
The Goal: Write functions to serialize your network data into a binary file (network.dat) using fwrite() right before exiting, and reload it using fread() automatically when the program boots up.
Syllabus Focus: Advanced File Handling (Binary Mode: "rb", "wb").
Testing Benchmark: Add a network of 4 stations, exit the application, restart it, and see your entire network instantly restored without re-typing anything.
