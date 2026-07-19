const SVG_NS = 'http://www.w3.org/2000/svg';

export const history = {
    initializeHistoryChart() {
        const cssUrl = new URL('history.css?v=3.3.4', import.meta.url).href;
        this.innerHTML = `
            <ha-card class="vpd-history-view">
                <style>@import '${cssUrl}'</style>
                <div class="history-chart-wrap">
                    <div class="history-header">
                        <div class="history-rooms" role="group" aria-label="Select room"></div>
                        <div class="history-reading" aria-live="polite">
                            <div><strong class="history-vpd">--</strong> <span class="history-kpa-unit">kPa</span></div>
                            <span class="history-phase"></span>
                            <span class="history-environment"></span>
                        </div>
                    </div>
                    <svg class="history-chart" viewBox="0 0 720 434" role="img" aria-label="VPD history"></svg>
                    <div class="history-tooltip" role="status"></div>
                    <div class="history-empty">No history available</div>
                </div>
            </ha-card>`;
        this.content = this.querySelector('.history-chart');
        this.normalizeHistorySelection();
        this.renderHistoryRoomButtons();
        this._historyResizeObserver?.disconnect();
        this._historyResizeObserver = new ResizeObserver(() => {
            const headerHeight = this.querySelector('.history-header')?.offsetHeight;
            if (this._historyData && (this.content?.clientWidth !== this._historyRenderedWidth || headerHeight !== this._historyRenderedHeaderHeight)) {
                this.renderHistorySvg(this._historyData);
            }
        });
        this._historyResizeObserver.observe(this.querySelector('.history-chart-wrap'));
        this._historyResizeObserver.observe(this.querySelector('.history-header'));
    },

    async buildHistoryChart() {
        if (!this.content || !this.querySelector('.vpd-history-view')) {
            this.initializeHistoryChart();
        }
        this.normalizeHistorySelection();
        this.renderHistoryRoomButtons();
        this.updateHistoryReading();

        const averaging = this.historySelectedRoom === 'average';
        const room = averaging ? null : this.config.rooms[this.historySelectedRoom];
        if (!averaging && !room) return;
        const roomKeys = averaging ? this.config.rooms : [room];
        const cacheKey = JSON.stringify([this.historySelectedRoom, roomKeys.map(item => [item.temperature, item.humidity, item.leaf_temperature, item.vpd]), this.ghostmap_hours]);
        const cacheFresh = this._historyCacheKey === cacheKey && Date.now() - (this._historyLastFetch || 0) < 300000;
        if (cacheFresh) {
            if (this._historyData && this.content.clientWidth !== this._historyRenderedWidth) {
                this.renderHistorySvg(this._historyData);
            }
            return;
        }

        const token = (this._historyRenderToken || 0) + 1;
        this._historyRenderToken = token;
        this._historyCacheKey = cacheKey;
        this._historyLastFetch = Date.now();
        const data = averaging ? await this.getAverageHistoryData() : await this.getHistoryRoomData(room);
        if (token !== this._historyRenderToken || !this.isConnected) return;
        this._historyData = data;
        this.renderHistorySvg(data);
    },

    cleanupHistory() {
        this._historyRenderToken = (this._historyRenderToken || 0) + 1;
        this._historyResizeObserver?.disconnect();
        this._historyResizeObserver = undefined;
    },

    formatHistoryPhase(name = '') {
        const locale = this._hass.locale?.language || this._hass.language || 'en';
        const portugueseLabels = {
            'danger-zone': 'Acima da faixa',
            'mid-late-flower': 'Floração',
            'late-veg': 'Vegetativo tardio',
            'early-veg': 'Vegetativo inicial',
            'under-transpiration': 'Baixa transpiração',
        };
        const normalizedName = String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');
        if (locale.toLowerCase().startsWith('pt') && portugueseLabels[normalizedName]) {
            return portugueseLabels[normalizedName];
        }
        const label = String(name).replace(/[-_]+/g, ' ').trim();
        return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
    },

    normalizeHistorySelection() {
        if (this.historySelectedRoom === 'average' && this.config.rooms.length > 1) return;
        const selected = Number.isInteger(this.historySelectedRoom) ? this.historySelectedRoom : 0;
        this.historySelectedRoom = Math.max(0, Math.min(selected, this.config.rooms.length - 1));
    },

    getHistoryAverageLabel() {
        const locale = this._hass.locale?.language || this._hass.language || 'en';
        return locale.toLowerCase().startsWith('pt') ? 'Média' : 'Average';
    },

    renderHistoryRoomButtons() {
        const container = this.querySelector('.history-rooms');
        if (!container) return;
        const fingerprint = `${this.config.rooms.map(room => room.name || room.vpd || room.temperature).join('|')}|${this.getHistoryAverageLabel()}`;
        if (container.dataset.fingerprint === fingerprint) return;
        container.dataset.fingerprint = fingerprint;
        container.replaceChildren();
        this.config.rooms.forEach((room, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = room.name || `Room ${index + 1}`;
            button.dataset.selection = String(index);
            button.className = index === this.historySelectedRoom ? 'active' : '';
            button.setAttribute('aria-pressed', String(index === this.historySelectedRoom));
            button.addEventListener('click', () => {
                this.historySelectedRoom = index;
                container.querySelectorAll('button').forEach(item => {
                    const active = item.dataset.selection === String(index);
                    item.classList.toggle('active', active);
                    item.setAttribute('aria-pressed', String(active));
                });
                this._historyLastFetch = 0;
                this.updateHistoryReading();
                this.buildHistoryChart();
            });
            container.appendChild(button);
        });
        if (this.config.rooms.length > 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = this.getHistoryAverageLabel();
            button.dataset.selection = 'average';
            button.className = this.historySelectedRoom === 'average' ? 'active' : '';
            button.setAttribute('aria-pressed', String(this.historySelectedRoom === 'average'));
            button.addEventListener('click', () => {
                this.historySelectedRoom = 'average';
                container.querySelectorAll('button').forEach(item => {
                    const active = item.dataset.selection === 'average';
                    item.classList.toggle('active', active);
                    item.setAttribute('aria-pressed', String(active));
                });
                this._historyLastFetch = 0;
                this.updateHistoryReading();
                this.buildHistoryChart();
            });
            container.appendChild(button);
        }
    },

    getCurrentRoomReading(room) {
        const temperatureEntity = this._hass.states[room.temperature];
        const humidityEntity = this._hass.states[room.humidity];
        const temperature = Number.parseFloat(temperatureEntity?.state);
        const humidity = Number.parseFloat(humidityEntity?.state);
        const vpdEntity = room.vpd && this._hass.states[room.vpd];
        const externalVpd = Number.parseFloat(vpdEntity?.state);
        const unit = temperatureEntity?.attributes?.unit_of_measurement || this.unit_temperature || '°C';
        if (Number.isFinite(externalVpd)) {
            return {temperature, humidity, vpd: externalVpd, unit};
        }
        if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) return null;
        const leafEntity = room.leaf_temperature && this._hass.states[room.leaf_temperature];
        const leafTemperature = Number.isFinite(Number.parseFloat(leafEntity?.state))
            ? Number.parseFloat(leafEntity.state)
            : temperature - Number(this.getLeafTemperatureOffset());
        const vpd = Number(this.calculateVPD(leafTemperature, temperature, humidity, unit));
        return {temperature, humidity, vpd, unit};
    },

    getCurrentHistoryReading() {
        if (this.historySelectedRoom !== 'average') {
            return this.getCurrentRoomReading(this.config.rooms[this.historySelectedRoom]);
        }
        const readings = this.config.rooms.map(room => this.getCurrentRoomReading(room)).filter(Boolean);
        if (!readings.length) return null;
        const average = key => {
            const values = readings.map(reading => reading[key]).filter(Number.isFinite);
            return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
        };
        return {
            vpd: average('vpd'),
            temperature: average('temperature'),
            humidity: average('humidity'),
            unit: readings.find(reading => reading.unit)?.unit || this.unit_temperature || '°C',
            sampleCount: readings.length,
        };
    },

    updateHistoryReading() {
        const reading = this.getCurrentHistoryReading();
        if (!reading) return;
        this.querySelector('.history-vpd').textContent = reading.vpd.toFixed(2);
        this.querySelector('.history-kpa-unit').textContent = this.kpa_text || 'kPa';
        this.querySelector('.history-phase').textContent = this.formatHistoryPhase(this.getPhaseClass(reading.vpd));
        this.querySelector('.history-environment').textContent = Number.isFinite(reading.temperature) && Number.isFinite(reading.humidity)
            ? `${reading.temperature.toFixed(1)} ${reading.unit} · ${reading.humidity.toFixed(0)}% ${this.rh_text || 'RH'}`
            : '';
    },

    async getHistoryRoomData(room) {
        const hours = Number(this.ghostmap_hours || 24);
        if (room.vpd && this._hass.states[room.vpd]) {
            const values = await this.getEntityHistory(room.vpd, hours);
            return values.map(item => ({time: new Date(item.last_changed).getTime(), vpd: Number.parseFloat(item.state)}))
                .filter(item => Number.isFinite(item.time) && Number.isFinite(item.vpd))
                .sort((a, b) => a.time - b.time);
        }

        const requests = [
            this.getEntityHistory(room.temperature, hours),
            this.getEntityHistory(room.humidity, hours),
        ];
        if (room.leaf_temperature) requests.push(this.getEntityHistory(room.leaf_temperature, hours));
        const [temperatures, humidities, leaves = []] = await Promise.all(requests);
        const unit = this._hass.states[room.temperature]?.attributes.unit_of_measurement || '°C';

        const nearest = (items, timestamp) => items.reduce((best, item) => {
            const distance = Math.abs(new Date(item.last_changed).getTime() - timestamp);
            return !best || distance < best.distance ? {item, distance} : best;
        }, null)?.item;

        return temperatures.map(item => {
            const time = new Date(item.last_changed).getTime();
            const temperature = Number.parseFloat(item.state);
            const humidity = Number.parseFloat(nearest(humidities, time)?.state);
            const leafValue = Number.parseFloat(nearest(leaves, time)?.state);
            const leafTemperature = Number.isFinite(leafValue)
                ? leafValue
                : temperature - Number(this.getLeafTemperatureOffset());
            return {
                time,
                vpd: Number(this.calculateVPD(leafTemperature, temperature, humidity, unit)),
                temperature,
                humidity,
                unit,
            };
        }).filter(item => Number.isFinite(item.time) && Number.isFinite(item.vpd)).sort((a, b) => a.time - b.time);
    },

    async getAverageHistoryData() {
        const series = await Promise.all(this.config.rooms.map(room => this.getHistoryRoomData(room)));
        const bucketSize = 3600000;
        const buckets = new Map();
        series.forEach((points, roomIndex) => {
            points.forEach(point => {
                const bucket = Math.floor(point.time / bucketSize) * bucketSize;
                if (!buckets.has(bucket)) buckets.set(bucket, new Map());
                buckets.get(bucket).set(roomIndex, point);
            });
        });
        const average = (points, key) => {
            const values = points.map(point => point[key]).filter(Number.isFinite);
            return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
        };
        return [...buckets.entries()].map(([time, roomPoints]) => {
            const points = [...roomPoints.values()];
            return {
                time,
                vpd: average(points, 'vpd'),
                temperature: average(points, 'temperature'),
                humidity: average(points, 'humidity'),
                unit: points.find(point => point.unit)?.unit || this.unit_temperature || '°C',
                sampleCount: points.length,
            };
        }).filter(point => Number.isFinite(point.vpd)).sort((a, b) => a.time - b.time);
    },

    renderHistorySvg(data) {
        const svg = this.querySelector('.history-chart');
        const empty = this.querySelector('.history-empty');
        if (!svg || !empty) return;
        const reading = this.getCurrentHistoryReading();
        const now = Date.now();
        const hours = Number(this.ghostmap_hours || 24);
        const start = now - hours * 3600000;
        const points = data.filter(item => item.time >= start && item.time <= now);
        points.sort((a, b) => a.time - b.time);
        if (reading) {
            const lastPoint = points.at(-1);
            if (lastPoint && now - lastPoint.time < 60000) {
                lastPoint.time = now;
                lastPoint.vpd = reading.vpd;
                lastPoint.temperature = reading.temperature;
                lastPoint.humidity = reading.humidity;
                lastPoint.unit = reading.unit;
                lastPoint.sampleCount = reading.sampleCount;
            } else {
                points.push({time: now, vpd: reading.vpd, temperature: reading.temperature, humidity: reading.humidity, unit: reading.unit, sampleCount: reading.sampleCount});
            }
        }
        svg.replaceChildren();
        this.hideHistoryTooltip();
        empty.style.display = points.length ? 'none' : 'block';
        if (!points.length) return;

        const width = 720;
        const header = this.querySelector('.history-header');
        const displayWidth = svg.clientWidth || width;
        const headerHeight = header?.offsetHeight || 40;
        const topMargin = Math.max(66, headerHeight * width / displayWidth + 30);
        const height = topMargin + 420 + 42;
        const margin = {left: 8, right: 8, top: topMargin, bottom: 42};
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this._historySvgHeight = height;
        this._historyRenderedWidth = svg.clientWidth;
        this._historyRenderedHeaderHeight = headerHeight;
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const configuredMax = Math.max(...this.vpd_phases.map(phase => phase.upper ?? phase.lower ?? 0), 2);
        const valueMax = Math.max(...points.map(point => point.vpd), configuredMax);
        const maxY = Math.ceil((valueMax + 0.2) * 5) / 5;
        const x = timestamp => margin.left + ((timestamp - start) / (now - start)) * plotWidth;
        const y = value => margin.top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
        const createSvg = (tag, attributes = {}) => {
            const element = document.createElementNS(SVG_NS, tag);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            return element;
        };

        this.vpd_phases.forEach(phase => {
            const lower = Math.max(0, Number(phase.lower ?? 0));
            const upper = Math.min(maxY, Number(phase.upper ?? maxY));
            if (upper <= lower) return;
            const reachesChartTop = upper >= maxY;
            const bandTop = reachesChartTop ? 0 : y(upper);
            const rect = createSvg('rect', {
                x: 0,
                y: bandTop,
                width,
                height: y(lower) - bandTop,
                fill: phase.color || 'currentColor',
                opacity: '0.24',
            });
            svg.appendChild(rect);
            const labelY = reachesChartTop ? margin.top + 16 : y(upper) + 16;
            const label = createSvg('text', {x: margin.left + 8, y: labelY, class: 'phase-label'});
            label.textContent = this.formatHistoryPhase(phase.className);
            svg.appendChild(label);
        });

        for (let index = 0; index <= 5; index++) {
            const value = maxY * index / 5;
            const lineY = y(value);
            svg.appendChild(createSvg('line', {x1: margin.left, y1: lineY, x2: width - margin.right, y2: lineY, class: 'grid-line'}));
        }

        const locale = this._hass.locale?.language || this._hass.language || 'en';
        const timeFormat = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit'});
        for (let index = 0; index <= 4; index++) {
            const time = start + (now - start) * index / 4;
            const lineX = x(time);
            svg.appendChild(createSvg('line', {x1: lineX, y1: margin.top, x2: lineX, y2: margin.top + plotHeight, class: 'grid-line'}));
            const label = createSvg('text', {x: lineX, y: height - 14, 'text-anchor': index === 0 ? 'start' : index === 4 ? 'end' : 'middle', class: 'axis-label'});
            label.textContent = timeFormat.format(new Date(time));
            svg.appendChild(label);
        }

        const pathData = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.time).toFixed(1)} ${y(point.vpd).toFixed(1)}`).join(' ');
        svg.appendChild(createSvg('path', {d: pathData, class: 'trend-line'}));

        points.forEach((point, index) => {
            if (index !== points.length - 1 && points.length > 30 && index % 2) return;
            const pointX = x(point.time);
            const pointY = y(point.vpd);
            const circle = createSvg('circle', {cx: pointX, cy: pointY, r: index === points.length - 1 ? 5 : 3, class: index === points.length - 1 ? 'current-point' : 'history-point'});
            const title = createSvg('title');
            title.textContent = `${timeFormat.format(new Date(point.time))}: ${point.vpd.toFixed(2)} kPa`;
            circle.appendChild(title);
            svg.appendChild(circle);
            if (this.enable_tooltip) {
                const hitArea = createSvg('circle', {
                    cx: pointX,
                    cy: pointY,
                    r: 12,
                    class: 'history-point-hit',
                    tabindex: '0',
                    role: 'button',
                    'aria-label': title.textContent,
                });
                const show = event => {
                    event.stopPropagation();
                    this.showHistoryTooltip(point, pointX, pointY, timeFormat);
                };
                hitArea.addEventListener('pointerenter', show);
                hitArea.addEventListener('focus', show);
                hitArea.addEventListener('click', show);
                hitArea.addEventListener('pointerleave', () => this.hideHistoryTooltip());
                hitArea.addEventListener('blur', () => this.hideHistoryTooltip());
                svg.appendChild(hitArea);
            }
        });

        const current = points.at(-1);
        const currentLabel = createSvg('text', {x: x(current.time) - 9, y: y(current.vpd) - 11, 'text-anchor': 'end', class: 'current-label'});
        currentLabel.textContent = `${current.vpd.toFixed(2)} kPa`;
        svg.appendChild(currentLabel);
    },

    showHistoryTooltip(point, pointX, pointY, timeFormat) {
        const tooltip = this.querySelector('.history-tooltip');
        const svg = this.querySelector('.history-chart');
        if (!tooltip || !svg) return;
        const phase = this.formatHistoryPhase(this.getPhaseClass(point.vpd));
        const details = [`${timeFormat.format(new Date(point.time))} · ${point.vpd.toFixed(2)} ${this.kpa_text || 'kPa'}`];
        if (phase) details.push(phase);
        if (point.sampleCount > 1) {
            const locale = this._hass.locale?.language || this._hass.language || 'en';
            details.push(locale.toLowerCase().startsWith('pt') ? `Média de ${point.sampleCount} sensores` : `Average of ${point.sampleCount} sensors`);
        }
        if (Number.isFinite(point.temperature) && Number.isFinite(point.humidity)) {
            details.push(`${point.temperature.toFixed(1)} ${point.unit || '°C'} · ${point.humidity.toFixed(0)}% ${this.rh_text || 'RH'}`);
        }
        tooltip.replaceChildren();
        details.forEach((detail, index) => {
            const line = document.createElement(index === 0 ? 'strong' : 'span');
            line.textContent = detail;
            tooltip.appendChild(line);
        });
        const wrap = this.querySelector('.history-chart-wrap');
        if (!wrap) return;
        const svgRect = svg.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const left = svgRect.left - wrapRect.left + pointX / 720 * svgRect.width;
        const top = svgRect.top - wrapRect.top + pointY / (this._historySvgHeight || 434) * svgRect.height;
        tooltip.style.visibility = 'hidden';
        tooltip.classList.add('visible');
        const tooltipRect = tooltip.getBoundingClientRect();
        const halfWidth = Math.min(tooltipRect.width || 180, wrapRect.width - 12) / 2;
        const clampedLeft = Math.min(Math.max(left, halfWidth + 6), wrapRect.width - halfWidth - 6);
        const showBelow = top - (tooltipRect.height || 64) - 10 < 6;
        tooltip.style.left = `${clampedLeft}px`;
        tooltip.style.top = `${top}px`;
        tooltip.classList.toggle('below', showBelow);
        tooltip.style.visibility = 'visible';
    },

    hideHistoryTooltip() {
        const tooltip = this.querySelector('.history-tooltip');
        tooltip?.classList.remove('visible', 'below');
        if (tooltip) tooltip.style.visibility = '';
    },
};
