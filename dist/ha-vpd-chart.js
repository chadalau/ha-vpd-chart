// Set version for the card 
window.vpdChartVersion = "3.2.4";

import {methods} from './methods.js?v=3.2.4';
import {chart} from './chart.js?v=3.2.4';
import {bar} from './bar.js?v=3.2.4';
import {history} from './history.js?v=3.2.4';
import {ghostmap} from './ghostmap.js?v=3.2.4';
import './ha-vpd-chart-editor.js?v=3.2.4';

const CONFIG_KEYS = [
    'vpd_phases', 'sensors', 'air_text', 'leaf_text', 'rh_text', 'kpa_text', 'min_temperature',
    'max_temperature', 'min_humidity', 'max_humidity', 'min_height',
    'is_bar_view', 'enable_axes', 'enable_ghostclick', 'enable_ghostmap', 'enable_triangle',
    'enable_tooltip', 'enable_crosshair', 'ghostmap_hours',
    'unit_temperature', 'enable_zoom', 'enable_legend', 'enable_show_always_informations',
    'leaf_temperature_offset', 'antialiasing', 'view_mode'
];

class HaVpdChart extends HTMLElement {
    constructor() {
        super();
        this.initializeDefaults(this);
    }

    connectedCallback() {
        this.style.display = 'block';
        this.style.width = '100%';
    }


    initializeDefaults() {
        this.vpd_phases = [
            {upper: 0, className: 'gray-danger-zone', color: '#999999'},
            {lower: 0, upper: 0.4, className: 'under-transpiration', color: '#1a6c9c'},
            {lower: 0.4, upper: 0.8, className: 'early-veg', color: '#22ab9c'},
            {lower: 0.8, upper: 1.2, className: 'late-veg', color: '#9cc55b'},
            {lower: 1.2, upper: 1.6, className: 'mid-late-flower', color: '#e7c12b'},
            {lower: 1.6, className: 'danger-zone', color: '#ce4234'},
        ];
        this.sensors = [];
        this.rooms = [];
        this.is_bar_view = false;
        this.view_mode = 'history';
        this.min_temperature = 5;
        this.max_temperature = 35;
        this.min_humidity = 10;
        this.max_humidity = 90;
        this.min_height = 200;
        this.leaf_temperature_offset = 2;
        this.steps_temperature = .1;
        this.steps_humidity = .1;
        this.enable_tooltip = true;
        this.air_text = "Air";
        this.leaf_text = "Leaf";
        this.rh_text = "RH";
        this.kpa_text = "kPa";
        this.unit_temperature = "°C";
        this.antialiasing = 5;
        this.enable_axes = true;
        this.enable_ghostclick = true;
        this.enable_ghostmap = true;
        this.enable_triangle = true;
        this.enable_crosshair = true;
        this.enable_zoom = true;
        this.enable_show_always_informations = true;
        this.enable_legend = true;
        this.configMemory = {};
        this.ghostmap_hours = 24;
        this.clickedTooltip = false;
    }

    static get properties() {
        return {
            rooms: {type: Array},
            min_temperature: {type: Number},
            max_temperature: {type: Number},
            min_humidity: {type: Number},
            max_humidity: {type: Number},
            leaf_temperature_offset: {type: Number},
            min_height: {type: Number},
            vpd_phases: {type: Array},
            air_text: {type: String},
            leaf_text: {type: String},
            rh_text: {type: String},
            kpa_text: {type: String},
            enable_tooltip: {type: Boolean},
            is_bar_view: {type: Boolean},
            enable_axes: {type: Boolean},
            enable_ghostclick: {type: Boolean},
            enable_ghostmap: {type: Boolean},
            enable_triangle: {type: Boolean},
            enable_crosshair: {type: Boolean},
            enable_zoom: {type: Boolean},
            enable_legend: {type: Boolean},
            enable_show_always_informations: {type: Boolean},
            configMemory: {type: Object},
            calculateVPD: {type: Function},
            ghostmap_hours: {type: Number},
            unit_temperature: {type: String},
            view_mode: {type: String},
        };
    }

    _hass = {};

    set hass(hass) {
        this._hass = hass;
        // Home Assistant can update hass several times in one render frame.
        if (!this._updateQueued) {
            this._updateQueued = true;
            requestAnimationFrame(() => {
                this._updateQueued = false;
                this.updateChartView();
            });
        }
    }

    updateChartView() {
        if (!this.config || !this.hasUsableRoom()) return;
        switch (this.config.antialiasing) {
            case 1:
                this.steps_temperature = 1;
                this.steps_humidity = 1;
                break;
            case 2:
                this.steps_temperature = .5;
                this.steps_humidity = .5;
                break;
            case 3:
                this.steps_temperature = .3;
                this.steps_humidity = .3;
                break;
            case 4:
                this.steps_temperature = .2;
                this.steps_humidity = .2;
                break;
            case 5:
                this.steps_temperature = .1;
                this.steps_humidity = .1;
                break;
            case 6:
                this.steps_temperature = .09;
                this.steps_humidity = .09;
                break;
            case 7:
                this.steps_temperature = .08;
                this.steps_humidity = .08;
                break;
            case 8:
                this.steps_temperature = .07;
                this.steps_humidity = .07;
                break;
            case 9:
                this.steps_temperature = .06;
                this.steps_humidity = .06;
                break;
            case 10:
                this.steps_temperature = .05;
                this.steps_humidity = .05;
                break;

        }
        switch (this.getActiveViewMode()) {
            case 'bar':
                this.buildBarChart();
                break;
            case 'chart':
                this.buildChart();
                break;
            default:
                this.buildHistoryChart();
        }
    }

    static getConfigElement() {
        return document.createElement("ha-vpd-chart-editor");
    }

    static getStubConfig() {
        return {
            rooms: [{name: '', temperature: '', humidity: ''}],
        };
    }

    getCardSize() {
        return this.getActiveViewMode() === 'bar' ? Math.max(1, this.config?.rooms?.length || 1) : 6;
    }

    getActiveViewMode() {
        return this.is_bar_view ? 'bar' : (this.view_mode || 'history');
    }

    disconnectedCallback() {
        this.cleanupChart?.();
        this.cleanupHistory?.();
    }

    setConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('The card configuration must be an object');
        }
        const previousViewMode = this.getActiveViewMode();
        this.config = config;

        if (!config.rooms) {
            if (config.sensors) {
                const newConfig = {...config};
                newConfig.rooms = newConfig.sensors;
                this.config = newConfig;
            } else {
                throw new Error('You need to define rooms');
            }
        }

        CONFIG_KEYS.forEach(key => {
            if (key in config) {
                this[key] = config[key];
            }
        });

        if (!Array.isArray(this.config.rooms)) {
            throw new Error('rooms must be a list');
        }

        if (this.content && previousViewMode !== this.getActiveViewMode()) {
            this.cleanupChart?.();
            this.cleanupHistory?.();
            this.replaceChildren();
            this.content = undefined;
            this.roomdom = undefined;
            this.ghostmapDom = undefined;
            this.mouseTooltip = undefined;
        }

        if (this.config.calculateVPD) {
            try {
                this.calculateVPD = new Function('Tleaf', 'Tair', 'RH', 'unit_of_measurement', this.config.calculateVPD);
            } catch (error) {
                console.error('HA VPD Chart: invalid calculateVPD formula', error);
            }
        }
    }
}

Object.assign(HaVpdChart.prototype, methods);
Object.assign(HaVpdChart.prototype, chart);
Object.assign(HaVpdChart.prototype, bar);
Object.assign(HaVpdChart.prototype, history);
Object.assign(HaVpdChart.prototype, ghostmap);
if (!customElements.get('ha-vpd-chart')) {
    customElements.define('ha-vpd-chart', HaVpdChart);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'ha-vpd-chart')) {
    window.customCards.push({
        type: "ha-vpd-chart",
        name: "Home Assistant VPD Chart",
        preview: false,
        description: "A custom card to display VPD values in a table",
        documentationURL: "https://github.com/chadalau/ha-vpd-chart",
    });
}
console.groupCollapsed(`%c HA-VPD-CHART v${window.vpdChartVersion} Installed`, "color: green; background: black; font-weight: bold;");
console.log('Readme: ', 'https://github.com/chadalau/ha-vpd-chart');
console.groupEnd();
