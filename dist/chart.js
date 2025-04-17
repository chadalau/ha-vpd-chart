export const chart = {
    async initializeChart() {
        this.zoomLevel = 1;
        this.minZoom = 1;
        this.maxZoom = 3;
        this.currentIndex = 0;
        this.htmlTemplate = `
            <ha-card>
                <div class="vpd-chart-view"  style="display:none;">
                    <style>
                        @import '##url##?v=${window.vpdChartVersion}'
                    </style>
                    <div id="vpd-card-container" class="vpd-card-container"></div>
                    <div id="ghostmap"></div>
                    <div id="rooms"></div>
                    <div class="mouse-custom-tooltip" style="opacity: 0;"></div>
                    <div id="mouse-tooltip">
                        <div class="horizontal-line mouse-horizontal-line" style="opacity: 0;"></div>
                        <div class="vertical-line mouse-vertical-line" style="opacity: 0;"></div>
                    </div>
                    <div class="vpd-legend"></div>
                </div>
            </ha-card>
        `;
        try {
            const cssUrl = `/hacsfiles/ha-vpd-chart/chart.css?v=${window.vpdChartVersion}`;
            const response = await fetch(cssUrl);
            if (response.ok) {
                this.innerHTML = this.htmlTemplate.replace('##url##', cssUrl);
            } else {
                // Use fallback URL directly if fetch fails
                this.innerHTML = this.htmlTemplate.replace('##url##', `/local/community/ha-vpd-chart/chart.css?v=${window.vpdChartVersion}`);
            }
        } catch (error) {
            // Catch other potential errors during fetch/network issues
            console.error("Error fetching CSS:", error);
            this.innerHTML = this.htmlTemplate.replace('##url##', `/local/community/ha-vpd-chart/chart.css?v=${window.vpdChartVersion}`);
        }

        // Initialize DOM references once
        this.content = this.querySelector("div.vpd-card-container");
        this.roomdom = this.querySelector("div#rooms");
        this.ghostmapDom = this.querySelector("div#ghostmap");
        this.mouseTooltip = this.querySelector("div#mouse-tooltip");
    },
    async buildChart() {
        if (!this.content) {
            await this.initializeChart.call(this);

            const tableContainer = this.querySelector('#vpd-table-container') || document.createElement('div');
            tableContainer.id = 'vpd-table-container';
            if (!this.content.querySelector('#vpd-table-container')) {
                this.content.appendChild(tableContainer);
            }
            await this.buildCanvas(tableContainer);

            this.setupEventListeners.call(this);

            this.updateGhostMapPeriodically.call(this);
        } else {
            const currentTime = Date.now();
            const shouldUpdateTable = (this.lastUpdate === undefined || currentTime - this.lastUpdate > (1500 + Math.random() * 1000));

            if (shouldUpdateTable) {
                requestAnimationFrame(async () => {
                    await this.buildCanvas(this.querySelector('#vpd-table-container'));
                });
                this.lastUpdate = currentTime;
            }
        }

        // Handle grid lines based on configuration
        this.enable_axes ? this.addGridLines() : this.removeGridLines();

        // Handle minimum height settings
        if (this.min_height > 0 && this.content) {
            this.content.style.minHeight = `${this.min_height}px`;

            // Apply min height to container elements
            const vpdContainer = this.querySelector("div.vpd-container");
            if (vpdContainer) {
                vpdContainer.style.minHeight = `${this.min_height}px`;
            }

            const tableContainers = this.querySelectorAll('div#vpd-table-container');
            tableContainers.forEach(tableContainer => {
                tableContainer.style.minHeight = `${this.min_height}px`;
            });
        }

        this.buildTooltip();
    },
    handleZoom(event) {
        event.preventDefault();
        const zoomDirection = event.deltaY > 0 ? -0.1 : 0.1;
        const rect = this.content.getBoundingClientRect();
        const offsetX = (event.clientX - rect.left) / this.zoomLevel;
        const offsetY = (event.clientY - rect.top) / this.zoomLevel;

        // Calculate new zoom level with constraints and rounding
        let newZoomLevel = Math.min(
            Math.max(this.zoomLevel + zoomDirection, this.minZoom),
            this.maxZoom
        );
        newZoomLevel = Math.round(newZoomLevel * 100) / 100;  // Round to 2 decimal places

        if (newZoomLevel === this.zoomLevel) return;

        this.zoomLevel = newZoomLevel;
        const transformOrigin = `${offsetX}px ${offsetY}px`;
        const transform = `scale(${this.zoomLevel})`;

        // Apply transforms to all zoomable elements
        const zoomableElements = [this.content, this.roomdom, this.ghostmapDom, this.mouseTooltip];
        zoomableElements.forEach(el => {
            el.style.transformOrigin = transformOrigin;
            el.style.transform = transform;
        });

        // Adjust tooltip sizes for zoom level
        this.querySelectorAll('.custom-tooltip').forEach(tooltip => {
            tooltip.style.fontSize = `${12 / this.zoomLevel}px`;
            tooltip.style.padding = `${7 / this.zoomLevel}px`;

            const icon = tooltip.querySelector('.cf-icon-svg');
            if (icon) {
                const iconSize = `${13 / this.zoomLevel}px`;
                icon.style.width = iconSize;
                icon.style.height = iconSize;
            }
        });
    },

    setupEventListeners() {
        // Basic mouse events
        this.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // Zoom-related events
        if (this.enable_zoom) {
            this.addEventListener('wheel', this.handleZoom.bind(this));
            this.addEventListener('mousedown', this.handleMouseDown.bind(this));
            this.addEventListener('mouseup', this.handleMouseUp.bind(this));

            // Handle middle-click to reset zoom
            this.addEventListener('auxclick', (event) => {
                if (event.button === 1) {
                    this.zoomLevel = 1;
                    const transform = `scale(${this.zoomLevel})`;

                    // Reset zoom on all elements
                    [this.content, this.roomdom, this.ghostmapDom, this.mouseTooltip].forEach(el => {
                        el.style.transform = transform;
                    });

                    // Reset tooltips
                    this.querySelectorAll('.custom-tooltip').forEach(tooltip => {
                        tooltip.style.fontSize = `${12 / this.zoomLevel}px`;
                        tooltip.style.padding = `${7 / this.zoomLevel}px`;

                        const icon = tooltip.querySelector('.cf-icon-svg');
                        if (icon) {
                            const iconSize = `${13 / this.zoomLevel}px`;
                            icon.style.width = iconSize;
                            icon.style.height = iconSize;
                        }
                    });
                }
            });
        }
    },
    updateGhostMapPeriodically() {
        if (this.enable_ghostmap) {
            this.updateGhostMap();
            setInterval(() => this.updateGhostMap(), 3600000); // Update every hour
        }
    },

    handleMouseDown(event) {
        this.isPanning = true;

        this.startX = event.clientX;
        this.startY = event.clientY;

        // Get current transform matrix
        const computedStyle = window.getComputedStyle(this.content);
        const matrix = new WebKitCSSMatrix(computedStyle.transform);

        this.startLeft = matrix.m41;
        this.startTop = matrix.m42;

        event.preventDefault();
    },
    handleMouseUp() {
        this.isPanning = false;
    },
    handleMouseMove(event) {
        event.preventDefault();
        const rect = this.content.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        // Calculate temperature and humidity values
        const temperatureRange = this.max_temperature - this.min_temperature;
        const humidityRange = this.max_humidity - this.min_humidity;

        let temperature = this.min_temperature + (temperatureRange * yPercent / 100);
        let humidity = this.max_humidity - (humidityRange * xPercent / 100);

        // Handle current room data
        if (this.config.rooms[this.currentIndex] !== undefined) {
            const room = this.config.rooms[this.currentIndex];
            let leafTemperatureOffset = this.getLeafTemperatureOffset();

            // Get leaf temperature if available
            if (room.leaf_temperature !== undefined &&
                this._hass.states[room.leaf_temperature] !== undefined) {
                leafTemperatureOffset = parseFloat(this._hass.states[room.temperature].state) - parseFloat(this._hass.states[room.leaf_temperature].state);
            }

            let leafTemperature = temperature - leafTemperatureOffset;
            let vpd = this.calculateVPD(leafTemperature, temperature, humidity, this._hass.states[room.temperature].attributes['unit_of_measurement']);
            this.buildMouseTooltip(event, humidity, temperature, vpd);

        }

        // Handle crosshair visualization
        if (this.enable_crosshair) {
            const mouseHorizontalLine = this.querySelector('.mouse-horizontal-line');
            const mouseVerticalLine = this.querySelector('.mouse-vertical-line');

            mouseHorizontalLine.style.top = `${y / this.zoomLevel}px`;
            mouseVerticalLine.style.left = `${x / this.zoomLevel}px`;
            mouseHorizontalLine.style.opacity = '1';
            mouseVerticalLine.style.opacity = '1';
        }

        // Handle panning
        if (this.isPanning && this.zoomLevel > 1) {
            const deltaX = event.clientX - this.startX;
            const deltaY = event.clientY - this.startY;
            const newLeft = this.startLeft + deltaX;
            const newTop = this.startTop + deltaY;
            const transform = `translate(${newLeft}px, ${newTop}px) scale(${this.zoomLevel})`;

            // Apply transform to all draggable elements
            [this.content, this.roomdom, this.ghostmapDom, this.mouseTooltip].forEach(el => {
                el.style.transform = transform;
            });
        }
    },

    positionTooltip(tooltip, percentageHumidity) {
        const containerWidth = this.content.offsetWidth;
        const tooltipCenter = tooltip.offsetLeft + (tooltip.offsetWidth / 2);

        // Handle tooltip positioning to avoid overflow
        if (tooltipCenter > containerWidth) {
            const overflowWidth = tooltipCenter - containerWidth + 5;
            tooltip.style.left = `calc(${percentageHumidity}% - ${overflowWidth}px)`;
        } else if ((tooltip.offsetLeft - (tooltip.offsetWidth / 2)) < 0) {
            const overflowWidth = (tooltip.offsetWidth / 2) - tooltip.offsetLeft + 5;
            tooltip.style.left = `calc(${percentageHumidity}% + ${overflowWidth}px)`;
        } else {
            tooltip.style.left = `${percentageHumidity}%`;
        }
        tooltip.style.visibility = 'visible';
    },

    async buildCanvas(container) {
        let currentLeafTemperatureOffset;
        const currentRoom = this.config.rooms[this.currentIndex];
        if (currentRoom) {
            const temperature = parseFloat(this._hass.states[currentRoom.temperature]?.state);
            if (!isNaN(temperature)) {
                this.unit_temperature = this._hass.states[currentRoom.temperature].attributes['unit_of_measurement'];
                console.log(this.unit_temperature);
                if (currentRoom.leaf_temperature && this._hass.states[currentRoom.leaf_temperature]) {
                    const leafTemperature = parseFloat(this._hass.states[currentRoom.leaf_temperature].state);
                    if (!isNaN(leafTemperature)) {
                        currentLeafTemperatureOffset = temperature - leafTemperature;
                    } else {
                        currentLeafTemperatureOffset = this.getLeafTemperatureOffset(); // Fallback
                    }
                } else {
                    currentLeafTemperatureOffset = this.getLeafTemperatureOffset(); // Fallback
                }
            } else {
                currentLeafTemperatureOffset = this.getLeafTemperatureOffset(); // Fallback
            }
        } else {
            currentLeafTemperatureOffset = this.getLeafTemperatureOffset(); // Fallback
        }


        if (this.vpdMatrix === null || currentLeafTemperatureOffset !== this._previousLeafTemperatureOffset) {

            this.vpdMatrix = this.createVPDMatrix(
                this.min_temperature,
                this.max_temperature,
                this.steps_temperature,
                this.max_humidity,
                this.min_humidity,
                this.steps_humidity,
                currentLeafTemperatureOffset
            );
            this._previousLeafTemperatureOffset = currentLeafTemperatureOffset; // save current offset
        }


        const processRoomCanvas = async (room, roomIndex) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    let tableContainer = container.querySelector(`.room-${roomIndex}-table-container`);
                    if (!tableContainer) {
                        tableContainer = document.createElement('div');
                        tableContainer.className = `room-${roomIndex}-table-container table-container`;
                        tableContainer.style.display = (roomIndex === this.currentIndex) ? 'flex' : 'none';
                        container.appendChild(tableContainer);
                    } else {
                        tableContainer.style.display = (roomIndex === this.currentIndex) ? 'flex' : 'none';
                    }

                    let canvas = tableContainer.querySelector('canvas');
                    if (!canvas) {
                        canvas = document.createElement('canvas');
                        tableContainer.replaceChildren(canvas);
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                        canvas.style.display = 'block';
                    }

                    const rect = tableContainer.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0 || tableContainer.style.display === 'none') {
                        resolve();
                        return;
                    }
                    canvas.width = rect.width;
                    canvas.height = rect.height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        console.error("VPD Chart: Could not get 2D context for room", roomIndex);
                        resolve();
                        return;
                    }

                    const vpdMatrix = this.vpdMatrix;
                    if (!vpdMatrix || vpdMatrix.length === 0 || !vpdMatrix[0] || vpdMatrix[0].length === 0) {
                        console.error("VPD Chart: Invalid VPD Matrix for drawing.");
                        resolve();
                        return;
                    }

                    const numTempSteps = vpdMatrix.length;
                    const numHumSteps = vpdMatrix[0].length;

                    const cellWidth = canvas.width / numHumSteps;
                    const cellHeight = canvas.height / numTempSteps;

                    for (let i = 0; i < numTempSteps; i++) {
                        for (let j = 0; j < numHumSteps; j++) {
                            if (!vpdMatrix[i] || vpdMatrix[i][j] === undefined) {
                                continue;
                            }
                            const cellData = vpdMatrix[i][j];
                            if (!cellData || typeof cellData.color === 'undefined') {
                                continue;
                            }
                            const x = j * cellWidth;
                            const y = i * cellHeight;


                            ctx.fillStyle = cellData.color;
                            ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellWidth + 0.5), Math.ceil(cellHeight + 0.5));
                        }
                    }
                    resolve();
                }, 0);
            });
        };

        if (this.currentIndex === undefined) {
            this.currentIndex = 0;
        }
        const roomPromises = this.config.rooms.map((room, roomIndex) =>
            processRoomCanvas(room, roomIndex)
        );


        try {
            await Promise.all(roomPromises);
            // console.log("VPD Chart: All room canvases processed.");
        } catch (error) {
            console.error("VPD Chart: Error processing rooms for canvas drawing", error);
        }
    },
    addGridLines() {
        let grid = this.querySelector('.vpd-grid');
        if (!grid) {
            grid = document.createElement('div');
            grid.className = 'vpd-grid';
            this.addHorizontalGridLines(grid);
            this.addVerticalGridLines(grid);
            this.content.appendChild(grid);
        }
    }, removeGridLines() {
        const grid = this.querySelector('.vpd-grid');
        if (grid) {
            grid.remove();
        }
    }, addHorizontalGridLines(grid) {
        const temperatureSteps = 7;
        if (!this.horizontalGridCache) {
            this.horizontalGridCache = new Array(temperatureSteps + 1);
        }

        // Create document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        for (let i = 0; i <= temperatureSteps; i++) {
            const positionPercent = `${(i / temperatureSteps) * 100}%`;
            const currentValue = this.min_temperature + (i * (this.max_temperature - this.min_temperature) / temperatureSteps);

            // Create or update grid elements
            if (!this.horizontalGridCache[i]) {
                const line = document.createElement('div');
                line.className = 'grid-line horizontal';
                line.style.top = positionPercent;

                const label = document.createElement('div');
                label.className = 'temperature-axis-label';

                this.horizontalGridCache[i] = {line, label, value: currentValue};
            }

            const {line, label, value} = this.horizontalGridCache[i];
            label.textContent = `${value.toFixed(0)}${this.unit_temperature}`;
            label.style.top = positionPercent;

            fragment.appendChild(line);
            // Only add labels in the middle (not at 0% or 100%)
            if (positionPercent !== '100%' && positionPercent !== '0%') {
                fragment.appendChild(label);
            }
        }

        grid.appendChild(fragment);
    },

    updateTemperatureUnit(newUnit = "°C") {

        this.unit_temperature = newUnit;

        // Update all temperature labels if grid cache exists
        if (this.horizontalGridCache) {
            this.horizontalGridCache.forEach(item => {
                if (item && item.label) {
                    item.label.textContent = `${item.value.toFixed(0)}${this.unit_temperature}`;
                }
            });
        }
    },
    addVerticalGridLines(grid) {
        const humiditySteps = 9;
        if (!this.verticalGridCache) {
            this.verticalGridCache = new Array(humiditySteps + 1);
        }

        // Create document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        for (let i = 0; i <= humiditySteps; i++) {
            const positionPercent = `${(i / humiditySteps) * 100}%`;
            const currentValue = this.max_humidity - (i * (this.max_humidity - this.min_humidity) / humiditySteps);

            // Create or update grid elements
            if (!this.verticalGridCache[i]) {
                const line = document.createElement('div');
                line.className = 'grid-line vertical';
                line.style.left = positionPercent;

                const label = document.createElement('div');
                label.className = 'humidity-axis-label';

                this.verticalGridCache[i] = {line, label, value: currentValue};
            }

            const {line, label, value} = this.verticalGridCache[i];
            label.textContent = `${value.toFixed(0)}%`;
            label.style.left = positionPercent;

            fragment.appendChild(line);
            // Only add labels in the middle (not at 0% or 100%)
            if (positionPercent !== '100%' && positionPercent !== '0%') {
                fragment.appendChild(label);
            }
        }

        grid.appendChild(fragment);
    },
    updateGhostMap() {
        this.fetchDataForRooms();
    },
    handleMouseLeave() {
        const banner = this.querySelector('.mouse-custom-tooltip');
        const verticalLine = this.querySelector('.mouse-vertical-line');
        const horizontalLine = this.querySelector('.mouse-horizontal-line');

        // Use requestAnimationFrame for smoother fadeout
        let opacity = 1;
        const fadeOut = () => {
            if (opacity <= 0) return;

            opacity -= 0.1;
            banner.style.opacity = opacity;
            verticalLine.style.opacity = opacity;
            horizontalLine.style.opacity = opacity;

            requestAnimationFrame(fadeOut);
        };

        requestAnimationFrame(fadeOut);
    },

    buildTooltip() {
        const rooms = this.querySelector('#rooms');
        this.config.rooms.forEach((room, index) => {
            // Ensure room has both humidity and temperature data
            if (!this._hass.states[room.humidity] || !this._hass.states[room.temperature]) return;

            const humidity = parseFloat(this._hass.states[room.humidity].state);
            const temperature = parseFloat(this._hass.states[room.temperature].state);

            // Handle leaf temperature
            let leafTemperature = temperature - this.getLeafTemperatureOffset();
            if (room.leaf_temperature && this._hass.states[room.leaf_temperature]) {
                leafTemperature = parseFloat(this._hass.states[room.leaf_temperature].state);
            }

            // Calculate VPD
            const vpd = this.calculateVPD(
                leafTemperature,
                temperature,
                humidity,
                this._hass.states[room.temperature].attributes['unit_of_measurement']
            );

            // Calculate position percentages
            const relativeTemperature = temperature - this.min_temperature;
            const totalTemperatureRange = this.max_temperature - this.min_temperature;
            const percentageTemperature = (relativeTemperature / totalTemperatureRange) * 100;
            const relativeHumidity = this.max_humidity - humidity;
            const totalHumidityRange = this.max_humidity - this.min_humidity;
            const percentageHumidity = ((relativeHumidity / totalHumidityRange) * 100).toFixed(1);

            // Create or update room elements
            if (!rooms.querySelector(`.room_${index}`)) {
                // Generate room name/icon
                let name = room.name || `<svg fill="#ffffff" width="13" height="13" viewBox="-1.7 0 20.4 20.4" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="0.32639999999999997"></g><g id="SVGRepo_iconCarrier"><path d="M16.476 10.283A7.917 7.917 0 1 1 8.56 2.366a7.916 7.916 0 0 1 7.916 7.917zm-5.034-2.687a2.845 2.845 0 0 0-.223-1.13A2.877 2.877 0 0 0 9.692 4.92a2.747 2.747 0 0 0-1.116-.227 2.79 2.79 0 0 0-1.129.227 2.903 2.903 0 0 0-1.543 1.546 2.803 2.803 0 0 0-.227 1.128v.02a.792.792 0 0 0 1.583 0v-.02a1.23 1.23 0 0 1 .099-.503 1.32 1.32 0 0 1 .715-.717 1.223 1.223 0 0 1 .502-.098 1.18 1.18 0 0 1 .485.096 1.294 1.294 0 0 1 .418.283 1.307 1.307 0 0 1 .281.427 1.273 1.273 0 0 1 .099.513 1.706 1.706 0 0 1-.05.45 1.546 1.546 0 0 1-.132.335 2.11 2.11 0 0 1-.219.318c-.126.15-.25.293-.365.424-.135.142-.26.28-.374.412a4.113 4.113 0 0 0-.451.639 3.525 3.525 0 0 0-.342.842 3.904 3.904 0 0 0-.12.995v.035a.792.792 0 0 0 1.583 0v-.035a2.324 2.324 0 0 1 .068-.59 1.944 1.944 0 0 1 .187-.463 2.49 2.49 0 0 1 .276-.39c.098-.115.209-.237.329-.363l.018-.02c.129-.144.264-.301.403-.466a3.712 3.712 0 0 0 .384-.556 3.083 3.083 0 0 0 .28-.692 3.275 3.275 0 0 0 .108-.875zM9.58 14.895a.982.982 0 0 0-.294-.707 1.059 1.059 0 0 0-.32-.212l-.004-.001a.968.968 0 0 0-.382-.079 1.017 1.017 0 0 0-.397.08 1.053 1.053 0 0 0-.326.212 1.002 1.002 0 0 0-.215 1.098 1.028 1.028 0 0 0 .216.32 1.027 1.027 0 0 0 .722.295.968.968 0 0 0 .382-.078l.005-.002a1.01 1.01 0 0 0 .534-.534.98.98 0 0 0 .08-.392z"></path></g></svg>`;

                // Create leaf temperature HTML if available
                let leafTemperatureHtml = "";
                if (room.leaf_temperature) {
                    leafTemperatureHtml = `<span class="roomLeaf_${index}">${this.leaf_text ? this.leaf_text + ': ' : ''}${leafTemperature}${this.unit_temperature}</span>`;
                }

                // Create room tooltip template
                const htmlTemplate = `
                    <div class="room room_${index}">
                        <div class="room-pointer-${index} room-pointer room-circle" data-index="${index}"></div>
                        <div class="horizontal-line horizontal-line-${index}" data-index="${index}"></div>
                        <div class="vertical-line vertical-line-${index}" data-index="${index}"></div>
                        <div class="custom-tooltip custom-tooltip-${index}" data-index="${index}">
                            <span class="room-name">${name}</span>
                            <div class="tooltipAdditionalInformations">
                                <span class="kpaText_${index}">${this.kpa_text ? this.kpa_text + ': ' : ''}${vpd}</span>
                                <span class="roomHumidity_${index}">${this.rh_text ? this.rh_text + ': ' : ''}${humidity}%</span>
                                <span class="roomAir_${index}" >${this.air_text ? this.air_text + ': ' : ''}${temperature}${this.unit_temperature}</span>
                                ${leafTemperatureHtml}
                                <span class="roomVPD_${index}" class="roomVPD_${index}">${this.getPhaseClass(vpd)}</span>
                            </div>
                        </div>
                    </div>
                `;

                rooms.insertAdjacentHTML('beforeend', htmlTemplate);
            }

            // Update pointer position and content
            this.updatePointer(index, percentageHumidity, percentageTemperature, room.name, vpd, humidity, temperature, leafTemperature);
        });
    },
    updatePointer(index, percentageHumidity, percentageTemperature, roomName = "", vpd, humidity, temperature, leafTemperature) {
        // Get or create pointer element
        const pointer = this.querySelector(`.room-pointer[data-index="${index}"]`) || document.createElement('div');
        pointer.setAttribute('data-index', index.toString());
        pointer.style.left = `${percentageHumidity}%`;
        pointer.style.bottom = `${100 - percentageTemperature}%`;
        pointer.className = this.enable_triangle ? 'highlight room-pointer room-triangle' : 'highlight room-pointer room-circle';
        pointer.classList.add(`room-pointer-${index}`);

        // Get or create horizontal line
        const horizontalLine = this.querySelector(`.horizontal-line[data-index="${index}"]`) || document.createElement('div');
        horizontalLine.className = `horizontal-line horizontal-line-${index}`;
        horizontalLine.setAttribute('data-index', index.toString());
        horizontalLine.style.top = `calc(${percentageTemperature}%)`;

        // Get or create vertical line
        const verticalLine = this.querySelector(`.vertical-line[data-index="${index}"]`) || document.createElement('div');
        verticalLine.className = `vertical-line vertical-line-${index}`;
        verticalLine.setAttribute('data-index', index.toString());
        verticalLine.style.left = `calc(${percentageHumidity}% - 0.5px)`;

        // Handle legend if enabled
        if (this.enable_legend) {
            const legend = this.querySelector('.vpd-legend');
            if (legend) {
                let legendElement = legend.querySelector(`.room-legend-${index}`) || document.createElement('div');
                legendElement.className = `room-legend room-legend-${index}`;
                legendElement.innerHTML = roomName || `Room ${index + 1}`;
                if (!legendElement.isConnected) {
                    legendElement.addEventListener('mouseover', (event) => {
                        event.stopImmediatePropagation();
                        this.showRoomDetails(index);
                    });
                    legendElement.addEventListener('mouseleave', (event) => {
                        event.stopImmediatePropagation();
                        this.hideRoomDetails(index);
                    });
                    legendElement.addEventListener('click', (event) => {
                        event.stopImmediatePropagation();
                        this.toggleRoomDetails(index);
                    });
                    legend.appendChild(legendElement);
                }
            }

            let tooltip = null;

            if (this.enable_tooltip) {
                tooltip = this.querySelector(`.custom-tooltip[data-index="${index}"]`) || document.createElement('div');
                tooltip.style.bottom = `${100 - percentageTemperature}%`;
                tooltip.style.left = `${percentageHumidity}%`;
                this.positionTooltip(tooltip, percentageHumidity);

                tooltip.setAttribute('data-index', index.toString());

                if (this.enable_show_always_informations) {
                    tooltip.querySelector('.tooltipAdditionalInformations').style.display = 'inline';
                }
                let kpaText = tooltip.querySelector('.kpaText_' + index);
                let rhText = tooltip.querySelector('.roomHumidity_' + index);
                let temperatureText = tooltip.querySelector('.roomAir_' + index);
                let leafTemperatureText = tooltip.querySelector('.roomLeaf_' + index);
                let phaseClass = tooltip.querySelector('.roomVPD_' + index);

                kpaText.innerHTML = `${this.kpa_text ? this.kpa_text + ': ' : ''}${vpd}`;
                rhText.innerHTML = `${this.rh_text ? this.rh_text + ': ' : ''}${humidity}%`;
                temperatureText.innerHTML = `${this.air_text ? this.air_text + ': ' : ''}${temperature}${this.unit_temperature}`;
                if (leafTemperatureText) {
                    leafTemperatureText.innerHTML = `${this.leaf_text ? this.leaf_text + ': ' : ''}${leafTemperature}${this.unit_temperature}`;
                }
                phaseClass.innerHTML = `${this.getPhaseClass(vpd)}`;
                tooltip.addEventListener('mouseover', (event) => {
                    event.stopImmediatePropagation();
                    this.showRoomDetails(index);
                });
                pointer.addEventListener('mouseover', (event) => {
                    event.stopImmediatePropagation();
                    this.showRoomDetails(index);
                });

                tooltip.addEventListener('mouseleave', (event) => {
                    event.stopImmediatePropagation();
                    this.hideRoomDetails(index);
                });
                pointer.addEventListener('mouseleave', (event) => {
                    event.stopImmediatePropagation();
                    this.hideRoomDetails(index);
                });


                if (this.enable_ghostclick) {
                    tooltip.addEventListener('click', (event) => {
                        event.stopImmediatePropagation();
                        this.toggleRoomDetails(index);
                    });
                    pointer.addEventListener('click', (event) => {
                        event.stopImmediatePropagation();
                        this.toggleRoomDetails(index);
                    });
                }
            } else {
                tooltip = this.querySelector(`.custom-tooltip[data-index="${index}"]`)
                if (tooltip) {
                    tooltip.remove();
                }
            }
            return {pointer, horizontalLine, verticalLine, tooltip};
        }
    },
    toggleRoomDetails(index) {
        this.clickedTooltip = !this.clickedTooltip;
        if (!this.clickedTooltip) {
            this.hideRoomDetails(index);
        } else {
            this.showRoomDetails(index);
        }
    },
    showRoomDetails(index) {
        this.currentIndex = index;

        this.querySelectorAll('.room, .table-container, .custom-tooltip').forEach(el => el.style.display = 'none');
        this.querySelectorAll(`.history-circle-${index}`).forEach(circle => circle.style.display = 'block');
        this.querySelectorAll(`.room_${index}`).forEach(el => el.style.display = 'block');
        this.querySelectorAll(`.room-${index}-table-container`).forEach(el => el.style.display = 'flex');
        this.updateTemperatureUnit(this._hass.states[this.config.rooms[index].temperature].attributes['unit_of_measurement']);
        this.querySelectorAll('.custom-tooltip').forEach(tooltip => {
            tooltip.style.display = tooltip.classList.contains(`custom-tooltip-${index}`) ? 'block' : 'none';
            if (tooltip.classList.contains(`custom-tooltip-${index}`)) {
                let classes = `custom-tooltip custom-tooltip-${index}`;
                if (this.clickedTooltip) {
                    classes += ' active';
                }
                tooltip.className = classes;
                tooltip.style.opacity = '0.85';
                tooltip.querySelector('.tooltipAdditionalInformations').style.display = 'inline';

                if (this.enable_legend) {
                    let legend = this.querySelector(`.room-legend-${index}`);
                    classes = `room-legend room-legend-${index}`;
                    if (this.clickedTooltip) {
                        classes += ' active';
                    }
                    legend.className = classes;

                }
            }
            this.positionTooltip(tooltip, parseFloat(tooltip.style.left));
        });

        this.querySelectorAll('.horizontal-line, .vertical-line, .room-pointer').forEach(el => {
            if (!el.classList.contains(`horizontal-line-${index}`) && !el.classList.contains(`vertical-line-${index}`) && !el.classList.contains(`room-pointer-${index}`)) {
                el.style.display = 'none';
            } else {
                el.style.display = 'block';
            }
        });
    },
    hideRoomDetails(index) {
        if (!this.clickedTooltip) {
            this.querySelectorAll('.custom-tooltip').forEach(tooltip => {
                tooltip.style.opacity = '1';
                tooltip.className = tooltip.className.split(' ').filter(c => c !== 'active').join(' ');
                if (this.enable_show_always_informations) {
                    this.querySelectorAll('.tooltipAdditionalInformations').forEach(tooltip => tooltip.style.display = 'inline');
                } else {
                    this.querySelectorAll('.tooltipAdditionalInformations').forEach(tooltip => tooltip.style.display = 'none');
                }

                this.positionTooltip(tooltip, parseFloat(tooltip.style.left));
            });
            this.querySelectorAll(`.history-circle-${index}`).forEach(circle => circle.style.display = 'none');
            this.querySelectorAll('.custom-tooltip, .horizontal-line, .vertical-line, .room-pointer').forEach(el => el.style.display = 'block');
        }
    },
    buildMouseTooltip(target, targetHumidity = null, targetTemperature = null, targetVpd = null) {
        const tooltip = this.querySelector('.mouse-custom-tooltip');
        tooltip.innerHTML = `${this.kpa_text ? this.kpa_text + ':' : ''} ${targetVpd} | ${this.rh_text ? this.rh_text + ':' : ''} ${parseFloat(targetHumidity).toFixed(1)}% | ${this.air_text ? this.air_text + ':' : ''} ${parseFloat(targetTemperature).toFixed(1)}${this.unit_temperature} | ${this.getPhaseClass(targetVpd)}`;
        tooltip.style.opacity = '1';
        if (this.enable_crosshair) {
            let mouseHorizontalLine = this.querySelector(`.mouse-horizontal-line`) || document.createElement('div');
            mouseHorizontalLine.className = `horizontal-line mouse-horizontal-line`;

            let mouseVerticalLine = this.querySelector(`.mouse-vertical-line`) || document.createElement('div');
            mouseVerticalLine.className = `vertical-line mouse-vertical-line`;

            let container = this.querySelector('.vpd-card-container');

            const {clientX, clientY} = target;
            // offset from vpd card container
            const rect = container.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            // calculate x and y with this.zoomlevel
            // relation

            mouseHorizontalLine.style.top = `${y / this.zoomLevel}px`;
            mouseVerticalLine.style.left = `${x / this.zoomLevel}px`;
            mouseVerticalLine.style.opacity = `1`;
            mouseHorizontalLine.style.opacity = `1`;

        }
    },
};
