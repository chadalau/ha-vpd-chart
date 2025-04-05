export const ghostmap = {
    filterEntriesByHour(entries) {
        const filteredEntries = [];
        const seenHours = new Set();

        for (const entry of entries) {
            const date = new Date(entry.last_changed);
            const hourKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;

            if (!seenHours.has(hourKey)) {
                seenHours.add(hourKey);
                filteredEntries.push(entry);
            }
        }

        return filteredEntries;
    },

    async fetchDataForRooms() {
        const fragment = document.createDocumentFragment();
        const ghostmap = this.querySelector('#ghostmap');

        if (!this._hass || !this.config || !this.config.rooms) {
            console.error('Missing required configuration or Home Assistant state');
            return;
        }

        const roomPromises = this.config.rooms.map(async (room, index) => {
            if (!room.humidity || !room.temperature) {
                console.warn(`Room at index ${index} is missing humidity or temperature sensors`);
                return;
            }

            if (this._hass.states[room.humidity] && this._hass.states[room.temperature]) {
                try {
                    const promises = [
                        this.getEntityHistory(room.temperature, this.config.ghostmap_hours),
                        this.getEntityHistory(room.humidity, this.config.ghostmap_hours)
                    ];

                    // Füge leafTemp-Sensor hinzu, falls vorhanden
                    if (room.leafTemp && this._hass.states[room.leafTemp]) {
                        promises.push(this.getEntityHistory(room.leafTemp, this.config.ghostmap_hours));
                    }

                    const results = await Promise.all(promises);
                    const temperatures = results[0];
                    const humidities = results[1];
                    const leafTemps = results.length > 2 ? results[2] : null;

                    if (temperatures && humidities) {
                        this.processSensorData(fragment, temperatures, humidities, leafTemps, index);
                    }
                } catch (error) {
                    console.error(`Error fetching data for room ${index}:`, error);
                }
            }
        });

        await Promise.all(roomPromises);

        if (ghostmap) {
            ghostmap.replaceChildren(fragment);
        } else {
            console.error('Ghostmap element not found');
        }
    },

    processSensorData(fragment, temperatures, humidities, leafTemps, index) {
        if (!temperatures.length || !humidities.length) {
            return;
        }

        const tempLength = temperatures.length;
        const fadeStep = tempLength > 1 ? 1 / (tempLength - 1) : 0;

        const reversedTemperatures = [...temperatures].reverse();
        const reversedHumidities = [...humidities].reverse();
        const reversedLeafTemps = leafTemps ? [...leafTemps].reverse() : null;

        let opacityFade = 1;

        for (let tempIndex = 0; tempIndex < reversedTemperatures.length; tempIndex++) {
            if (tempIndex >= reversedHumidities.length) {
                continue; // Skip if no matching humidity data
            }

            const temperature = reversedTemperatures[tempIndex];
            const humidity = parseFloat(reversedHumidities[tempIndex].state);
            const leafTemp = reversedLeafTemps && tempIndex < reversedLeafTemps.length ?
                parseFloat(reversedLeafTemps[tempIndex].state) : null;

            if (isNaN(humidity) || isNaN(parseFloat(temperature.state)) ||
                (leafTemp !== null && isNaN(leafTemp))) {
                continue; // Skip invalid data
            }

            opacityFade = Math.max(0, opacityFade - fadeStep);

            const circle = this.createCircle(index, tempIndex, temperature, humidity, leafTemp, opacityFade);
            fragment.appendChild(circle);
        }
    },

    createCircle(index, tempIndex, temperature, humidity, leafTemp, opacityFade) {
        if (!this.hasOwnProperty('zoomLevel') || !this.hasOwnProperty('max_humidity') ||
            !this.hasOwnProperty('min_humidity') || !this.hasOwnProperty('max_temperature') ||
            !this.hasOwnProperty('min_temperature')) {
            console.warn('Missing required properties for circle creation');
            // Set defaults to prevent errors
            this.zoomLevel = this.zoomLevel || 1;
            this.max_humidity = this.max_humidity || 100;
            this.min_humidity = this.min_humidity || 0;
            this.max_temperature = this.max_temperature || 40;
            this.min_temperature = this.min_temperature || 0;
            this.leaf_temp_factor = this.leaf_temp_factor || 0.5; // Faktor für Blatttemperatur-Einfluss
        }

        const tempState = parseFloat(temperature.state);
        const humidityValue = parseFloat(humidity);

        // Berechne Luftfeuchtigkeitsposition
        const relativeHumidity = this.max_humidity - (humidityValue * this.zoomLevel);
        const totalHumidityRange = this.max_humidity - this.min_humidity || 1; // Prevent division by zero
        const percentageHumidity = Math.min(100, Math.max(0, (relativeHumidity / totalHumidityRange) * 100));

        // Berechne Temperaturposition, berücksichtige leafTemp falls vorhanden
        let percentageTemperature;

        if (leafTemp !== null) {
            // Gewichteter Durchschnitt zwischen normaler Temperatur und Blatttemperatur
            const combinedTemp = (tempState * (1 - this.leaf_temp_factor)) + (leafTemp * this.leaf_temp_factor);
            const relativeTemperature = (combinedTemp * this.zoomLevel) - this.min_temperature;
            const totalTemperatureRange = this.max_temperature - this.min_temperature || 1;
            percentageTemperature = Math.min(100, Math.max(0, (relativeTemperature / totalTemperatureRange) * 100));
        } else {
            // Originale Berechnung ohne leafTemp
            const relativeTemperature = (tempState * this.zoomLevel) - this.min_temperature;
            const totalTemperatureRange = this.max_temperature - this.min_temperature || 1;
            percentageTemperature = Math.min(100, Math.max(0, (relativeTemperature / totalTemperatureRange) * 100));
        }

        const circle = document.createElement('div');
        circle.className = `highlight history-circle history-circle-${index}`;
        circle.style.left = `${percentageHumidity}%`;
        circle.style.bottom = `${100 - percentageTemperature}%`;
        circle.style.opacity = Math.max(0.1, Math.min(1, opacityFade)); // Ensure opacity is between 0.1 and 1

        // Speichere alle relevanten Daten als Attribute
        circle.dataset.humidity = humidityValue;
        circle.dataset.temperature = tempState;
        if (leafTemp !== null) {
            circle.dataset.leafTemperature = leafTemp;
        }
 
        return circle;
    }
};