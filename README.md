# erebus-cesium

## Background

Project Erebus is an epic children's adventure taking its inspiration from the 1839 Ross Expedition - the last, and greatest, polar expedition ever undertaken by sail. Two adventurous brothers, Ollie and Harry, have set out to send scaled replicas of HMS Erebus and HMS Terror to drift through the Southern Ocean following the circumpolar current around the coastline of Antarctica, a journey of over 20,000 km.

Icoteq have designed bespoke tracking and monitoring devices for this project that use the ARGOS satellite network to report back the location of each boat with scientific data collected along the journey.  This includes air temperature, ocean temperature and ocean pH, a key marker for climate change. Once a month each device will take a photograph from the deck of the boat and upload it to our server to give an idea of the conditions at the boat location.

A commemoration to the original expedition, this project brings together the involvement of children in science, technology and engineering subjects (STEM), the application of low cost sensors for environmental monitoring and the notion of citizen science contributing to the gathering of important scientific data at scale.

Follow the journey of Terror and Erebus at http:://icoteq.com/project-erebus, click on the waypoints for images and sensor data, and join the discussion at https://www.facebook.com/tdajp!

## What's this repo?

We've decided to open source our 3D mapping rendering and provide access to our data so that the community may contribute and improve upon the baseline mapping.  If you have any comments/suggests raise a CR or otherwise feel free to submit a PR with your own improvements!

## How does it work?

The 3D mapping in `static/scripts/main.js` uses cesium ion @ http://cesium.com.  This is a platform for 3D geospatial mapping.  This repo allows you to deploy a sandbox docker container that runs a webserver and our baseline 3d mapping software built upon cesium ion.

A snapshot of the real-world data used can be found under the `static/geojson` and `static/images` subdirectories.

## How to run it

Run the following commands:

``
docker-compose build
docker up -d
``

Then point your web browser to http://127.0.0.1:5000 or the machine IP address which is running the docker on your network.

## Getting data updates

Data is updated aperiodically, subject to satellite passovers, to the following URL at most once per hour:

https://icoteq.egnyte.com/dl/XaN8yCHsqr

Click the `download` link and unzip the downloaded zip file in your working repo directory and it will update your data set.  You will need to refresh your browser window to see the updates take effect.
