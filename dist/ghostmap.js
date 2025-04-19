export const ghostmap = {
    _lastFetchTimestamp: 0,
    filterEntriesByHour(entries) {
        const filteredEntries = [];
        const seenHours = new Set();

        entries.forEach(entry => {
            const date = new Date(entry.last_changed);
            const hourKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;

            if (!seenHours.has(hourKey)) {
                seenHours.add(hourKey);
                filteredEntries.push(entry);
            }
        });

        return filteredEntries;
    },

    async fetchDataForRooms() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (this._lastFetchTimestamp && (now - this._lastFetchTimestamp < oneHour)) {
            return;
        }

        const fragment = document.createDocumentFragment();
        const ghostmap = this.querySelector('#ghostmap');

        const roomPromises = this.config.rooms.map(async (room, index) => {
            if (this._hass.states[room.humidity] && this._hass.states[room.temperature]) {
                if (this._hass.states[room.leaf_temperature]) {
                    const [temperatures, humidities, leaf_temperatures] = await Promise.all([
                        this.getEntityHistory(room.temperature, this.config.ghostmap_hours),
                        this.getEntityHistory(room.humidity, this.config.ghostmap_hours),
                        this.getEntityHistory(room.leaf_temperature, this.config.ghostmap_hours)
                    ]);
                    this.processSensorDataSidebar(fragment, temperatures, humidities, leaf_temperatures, index);

                } else {
                    const [temperatures, humidities] = await Promise.all([
                        this.getEntityHistory(room.temperature, this.config.ghostmap_hours),
                        this.getEntityHistory(room.humidity, this.config.ghostmap_hours)
                    ]);
                    this.processSensorData(fragment, temperatures, humidities, index);

                }


            }
        });

        await Promise.all(roomPromises);

        ghostmap.replaceChildren(fragment);

        this._lastFetchTimestamp = now;
    },

    processSensorData(fragment, temperatures, humidities, index) {
        let opacityFade = 1;
        let fadeStep = (1 / (temperatures.length - 1)).toFixed(2);
        temperatures.reverse();
        temperatures.forEach((temperature, tempIndex) => {
            if (humidities[tempIndex]) {
                opacityFade -= fadeStep;
                let humidity = (humidities[tempIndex].state);
                const circle = this.createCircle(index, tempIndex, temperature, humidity, opacityFade);
                fragment.appendChild(circle);
            }
        });
    },

    processSensorDataSidebar(fragment, temperatures, humidities, leaf_temperatures = [], index) {
        // clear #ghostmap
        const ghostmap = this.querySelector('#ghostmap');
        ghostmap.innerHTML = '';

        temperatures.reverse();
        temperatures.forEach((temperature, tempIndex) => {
            if (humidities[tempIndex]) {
                let humidity = (humidities[tempIndex].state);
                let leaf_temperature = '';
                if (leaf_temperatures.length > 0) {
                    if (leaf_temperatures[tempIndex]) {
                        leaf_temperature = leaf_temperatures[tempIndex].state
                    }
                }
                // create div entry for sidebar
                const entry = document.createElement('div');
                // write sensor data to div
                // reformat timestamp from last_changed to d.m.Y - H:i:s
                let last_changed = new Date(temperature.last_changed);
                last_changed = last_changed.toLocaleString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'});
                let unit_of_measurement = this._hass.states[this.config.rooms[index].temperature].attributes['unit_of_measurement'];
                let vpd = this.calculateVPD(parseFloat(leaf_temperature), parseFloat(temperature.state), parseFloat(humidity), unit_of_measurement);

                // Define styles separately for clarity
                const divStyle = `
                    width: 98%;
                    padding: 1%;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 12px;
                    color: white;
                    position: relative;
                `;

                const vpdColor = this.getColorForVpd(vpd);
                const vpdPhaseClass = this.getPhaseClass(vpd);
                const vpdStyle = ` 
                    background: ${vpdColor};
                    padding: 2px 5px;
                    border-radius: 4px;
                    font-size: 11px;
                    display: inline-block;
                    margin-left: 5px;
                `;

                // Assign multi-line HTML using template literal
                entry.innerHTML = `
                    <div style="${divStyle}" class="history-row-${index}">
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; margin-bottom: 5px;">
                            <div style="width:50%; float:left;">
                                <div style="--mdc-icon-size: 16px;"><div style="width:15px; float:left; margin-right:5px;"><ha-icon icon="mdi:thermometer"></ha-icon></div><span><b>${temperature.state + unit_of_measurement}</b></span></div>
                                <div style="--mdc-icon-size: 16px;"><div style="width:15px; float:left; margin-right:5px;"><ha-icon icon="mdi:leaf"></ha-icon></div><b>${leaf_temperature ? leaf_temperature + unit_of_measurement : 'N/A'}</b></div>
                                <div style="--mdc-icon-size: 16px;"><div style="width:15px; float:left; margin-right:5px;"><ha-icon icon="mdi:water-percent"></ha-icon></div> <b>${humidity}%</b></div>
                            </div>
                            <div style="width:50%; float:right; text-align: right;">
                                <div>
                                    ${last_changed}
                                </div><br>
                                <div style="${vpdStyle}" class="vpd-state ${vpdPhaseClass}"></div>
                                <div>${vpdPhaseClass} (${vpd})</div>
                            </div>
                        </div>
                    </div>
                `;
                fragment.appendChild(entry);
            }
        });
    },

    createCircle(index, tempIndex, temperature, humidity, opacityFade) {
        const relativeHumidity = this.max_humidity - (humidity * this.zoomLevel);
        const totalHumidityRange = this.max_humidity - this.min_humidity;
        const percentageHumidity = (relativeHumidity / totalHumidityRange) * 100;

        const relativeTemperature = (temperature.state * this.zoomLevel) - this.min_temperature;
        const totalTemperatureRange = this.max_temperature - this.min_temperature;
        const percentageTemperature = (relativeTemperature / totalTemperatureRange) * 100;

        const circle = document.createElement('div');
        circle.className = `highlight history-circle history-circle-${index}`;
        circle.style.left = `${percentageHumidity}%`;
        circle.style.bottom = `${100 - percentageTemperature}%`;
        circle.style.opacity = opacityFade;

        circle.dataset.humidity = humidity;
        circle.dataset.temperature = temperature.state;

        return circle;
    }
};
