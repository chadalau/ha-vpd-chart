import {methods} from './methods.js';
import {MultiRange} from './ha-vpd-chart-editor-multiRange.js';

const DEFAULT_CONFIG = {
    type: 'custom:ha-vpd-chart',
    rooms: [{name: '', temperature: '', leaf_temperature: '', humidity: '', min_temperature: 5, max_temperature: 35, min_humidity: 10, max_humidity: 90}],
    vpd_phases: [
        {upper: 0, className: 'gray-danger-zone', color: '#999999'},
        {lower: 0, upper: 0.4, className: 'under-transpiration', color: '#1a6c9c'},
        {lower: 0.4, upper: 0.8, className: 'early-veg', color: '#22ab9c'},
        {lower: 0.8, upper: 1.2, className: 'late-veg', color: '#9cc55b'},
        {lower: 1.2, upper: 1.6, className: 'mid-late-flower', color: '#e7c12b'},
        {lower: 1.6, className: 'danger-zone', color: '#ce4234'},
    ],
    is_bar_view: false,
    min_height: 200,
    leaf_temperature_offset: 2,
    enable_tooltip: true,
    air_text: 'Air',
    leaf_text: 'Leaf',
    rh_text: 'RH',
    kpa_text: 'kPa',
    enable_axes: true,
    enable_ghostclick: true,
    enable_ghostmap: true,
    enable_triangle: true,
    enable_crosshair: true,
    enable_zoom: true,
    enable_show_always_informations: true,
    enable_legend: true,
    ghostmap_hours: 24,
    antialiasing: 5,
    unit_temperature: '°C',
};

export class HaVpdChartEditor extends HTMLElement {
    config = {};

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.config = this._mergeDefaults({});
    }

    set hass(hass) {
        this._hass = hass;
    }

    get _air_text() {
        return this.config.air_text;
    }

    get _leaf_text() {
        return this.config.leaf_text;
    }

    get _rh_text() {
        return this.config.rh_text;
    }

    get _kpa_text() {
        return this.config.kpa_text;
    }

    get _vpd_phases() {
        return this.config.vpd_phases;
    }

    get _min_temperature() {
        return this.config.min_temperature;
    }

    get _max_temperature() {
        return this.config.max_temperature;
    }

    get _min_humidity() {
        return this.config.min_humidity;
    }

    get _max_humidity() {
        return this.config.max_humidity;
    }

    get _min_height() {
        return this.config.min_height;
    }

    get _leaf_temperature_offset() {
        return this.config.leaf_temperature_offset;
    }

    get _is_bar_view() {
        return this.config.is_bar_view;
    }

    get _enable_axes() {
        return this.config.enable_axes;
    }

    get _enable_ghostclick() {
        return this.config.enable_ghostclick;
    }

    get _enable_ghostmap() {
        return this.config.enable_ghostmap;
    }

    get _enable_triangle() {
        return this.config.enable_triangle;
    }

    get _enable_crosshair() {
        return this.config.enable_crosshair;
    }

    get _enable_tooltip() {
        return this.config.enable_tooltip;
    }

    get _ghostmap_hours() {
        return this.config.ghostmap_hours;
    }

    get _antialiasing() {
        return this.config.antialiasing;
    }

    get _unit_temperature() {
        return this.config.unit_temperature;
    }

    get _enable_zoom() {
        return this.config.enable_zoom;
    }

    get _enable_show_always_informations() {
        return this.config.enable_show_always_informations;
    }

    get _enable_legend() {
        return this.config.enable_legend;
    }

    _mergeDefaults(userConfig) {
        const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        Object.keys(userConfig).forEach(key => {
            if (userConfig[key] !== undefined) cfg[key] = userConfig[key];
        });
        return cfg;
    }

    setConfig(config) {
        this.config = this._mergeDefaults(config);
        if (this.config.calculateVPD) {
            this.calculateVPD = new Function('Tleaf', 'Tair', 'RH', this.config.calculateVPD);
        }
    }

    copyConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    checkValue(target) {
        let value = target.value;
        if (target.tagName === 'HA-CHECKBOX') {
            return target.checked;
        }
        if (typeof value === 'string' && value.trim() !== '' && !isNaN(value)) {
            return parseFloat(value);
        }
        if (value === 'on') return true;
        if (value === 'off') return false;
        if (value === '') return undefined;
        if (target.detail && target.detail.value !== undefined) {
            return target.detail.value;
        }
        return value;
    }

    handleValueChange = (ev) => {
        const target = ev.target || ev;
        const key = target.id;
        const value = this.checkValue(target);
        const cfg = this.copyConfig();
        if (cfg[key] !== value) {
            cfg[key] = value;
            this.config = cfg;
            this.fireEvent(this, 'config-changed', {config: cfg});
        }
    }

    handleVPDPhaseChange = (ev) => {
        const idx = Number(ev.target.dataset.index);
        const newClass = ev.target.value;
        const cfg = this.copyConfig();
        if (cfg.vpd_phases[idx].className !== newClass) {
            cfg.vpd_phases[idx].className = newClass;
            this.config = cfg;
            this.fireEvent(this, 'config-changed', {config: cfg});
        }
    }

    connectedCallback() {
        setTimeout(() => {
            if (this.shadowRoot) {
                this.shadowRoot.addEventListener('mouseover', this.showGlobalTooltip.bind(this));
                this.shadowRoot.addEventListener('mouseout', this.hideGlobalTooltip.bind(this));
            } else {
                console.error('shadowRoot not found when trying to attach listeners.');
            }
        }, 0);

        try {
            import('./lang/' + this._hass.language + '.js').then((module) => {
                this.language = module.language;
                this.render();
                this.initValues();
                this.initRooms();
                this.initColorEditor();
                this.initAddButton();
                this.initFormulaEditor();
            }).catch(() => {
                import('./lang/en.js').then((module) => {
                    this.language = module.language;
                    this.render();
                    this.initValues();
                    this.initRooms();
                    this.initColorEditor();
                    this.initAddButton();
                    this.initFormulaEditor();
                });
            });
        } catch (error) {
            console.error("Error loading language file:", error);
            import('./lang/en.js').then((module) => {
                this.language = module.language;
                this.render();
                this.initValues();
                this.initRooms();
                this.initColorEditor();
                this.initAddButton();
                this.initFormulaEditor();
            }).catch(err => console.error("Failed to load fallback language file:", err));
        }
    }

    render() {
        this.shadowRoot.innerHTML = `<style>
@import '/local/community/ha-vpd-chart/ha-vpd-chart-editor.css?v=${window.vpdChartVersion}'
</style>
<div class="vpd-chart-config">
  <button type="button" class="collapsible ">${this.language.buttons.rooms}</button>
  <div class="content"><div><div class="roomEditor"></div></div></div>
  <button type="button" class="collapsible active">${this.language.buttons.main_settings}</button>
  <div class="content" style="max-height:fit-content;"><div><table>
    <tr><td><ha-textfield label="${this.language.air_text}" id="air_text"></ha-textfield></td>
        <td><ha-textfield label="${this.language.leaf_text}" id="leaf_text"></ha-textfield></td></tr>
    <tr><td><ha-textfield label="${this.language.rh_text}" id="rh_text"></ha-textfield></td>
        <td><ha-textfield label="${this.language.kpa_text}" id="kpa_text"></ha-textfield></td></tr>
    <tr><td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.min_temperature}" id="min_temperature"></ha-textfield></td>
        <td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.max_temperature}" id="max_temperature"></ha-textfield></td></tr>
    <tr><td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.min_humidity}" id="min_humidity"></ha-textfield></td>
        <td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.max_humidity}" id="max_humidity"></ha-textfield></td></tr>
    <tr><td><ha-textfield type="text" label="${this.language.leaf_temperature_offset}" id="leaf_temperature_offset"></ha-textfield></td>
        <td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.ghostmap_hours}" id="ghostmap_hours"></ha-textfield></td></tr>
    <tr><td><ha-textfield pattern="[0-9]+([.][0-9]+)?" min="1" max="10" type="number" title="${this.language.antialiasing}" label="${this.language.antialiasing.substring(0, 20)}..." id="antialiasing"></ha-textfield></td>
        <td><ha-textfield pattern="[0-9]+([.][0-9]+)?" type="number" label="${this.language.min_height}" id="min_height"></ha-textfield></td></tr>
  </table></div></div>
  <button type="button" class="collapsible">${this.language.buttons.features}</button>
  <div class="content"><div><table>
    <tr><td><ha-formfield data-helptext="${this.language.description.is_bar_view}" label="${this.language.titles.is_bar_view}"><ha-checkbox id="is_bar_view"></ha-checkbox></ha-formfield></td>
        <td><ha-formfield data-helptext="${this.language.description.enable_axes}" label="${this.language.titles.enable_axes}"><ha-checkbox id="enable_axes"></ha-checkbox></ha-formfield></td></tr>
    <tr><td><ha-formfield data-helptext="${this.language.description.enable_ghostmap}" label="${this.language.titles.enable_ghostmap}"><ha-checkbox id="enable_ghostmap"></ha-checkbox></ha-formfield></td>
        <td><ha-formfield data-helptext="${this.language.description.enable_ghostclick}" label="${this.language.titles.enable_ghostclick}"><ha-checkbox id="enable_ghostclick"></ha-checkbox></ha-formfield></td></tr>
    <tr><td><ha-formfield data-helptext="${this.language.description.enable_triangle}" label="${this.language.titles.enable_triangle}"><ha-checkbox id="enable_triangle"></ha-checkbox></ha-formfield></td>
        <td><ha-formfield data-helptext="${this.language.description.enable_tooltip}" label="${this.language.titles.enable_tooltip}"><ha-checkbox id="enable_tooltip"></ha-checkbox></ha-formfield></td></tr>
    <tr><td><ha-formfield data-helptext="${this.language.description.enable_crosshair}" label="${this.language.titles.enable_crosshair}"><ha-checkbox id="enable_crosshair"></ha-checkbox></ha-formfield></td>
        <td><ha-formfield data-helptext="${this.language.description.enable_zoom}" label="${this.language.titles.enable_zoom}"><ha-checkbox id="enable_zoom"></ha-checkbox></ha-formfield></td></tr>
    <tr><td><ha-formfield data-helptext="${this.language.description.enable_legend}" label="${this.language.titles.enable_legend}"><ha-checkbox id="enable_legend"></ha-checkbox></ha-formfield></td>
        <td><ha-formfield data-helptext="${this.language.description.enable_show_always_informations}"><ha-checkbox id="enable_show_always_informations"></ha-checkbox><label>${this.language.titles.enable_show_always_informations}</label></ha-formfield></td></tr>
  </table></div></div>
  <button type="button" class="collapsible">${this.language.buttons.phases}</button>
  <div class="content"><div><div id="slider-container" class="slider-container"><div id="slider-labels" class="slider-labels"></div></div><div class="colorEditor"></div></div></div>
  <button type="button" class="collapsible">${this.language.buttons.vpd_calibration}</button>
  <div class="content"><div class="formulaEditor"></div></div>
</div>
<div id="global-tooltip"></div>`;

        const debounced = this.debounce(this.handleValueChange, 500);
        this.shadowRoot.querySelectorAll('ha-switch, ha-textfield, input').forEach(input => input.addEventListener('input', () => debounced(input)));
        this.shadowRoot.querySelectorAll('ha-checkbox').forEach(cb => cb.addEventListener('change', this.handleValueChange));
        this.shadowRoot.querySelectorAll('.collapsible').forEach(col => col.addEventListener('click', () => {
            col.classList.toggle('active');
            const c = col.nextElementSibling;
            c.style.maxHeight = c.style.maxHeight ? null : 'fit-content';
        }));
    }

    initValues() {
        const configValues = [
            {id: 'air_text', prop: '_air_text', type: 'value'},
            {id: 'leaf_text', prop: '_leaf_text', type: 'value'},
            {id: 'rh_text', prop: '_rh_text', type: 'value'},
            {id: 'kpa_text', prop: '_kpa_text', type: 'value'},
            {id: 'min_temperature', prop: '_min_temperature', type: 'value'},
            {id: 'max_temperature', prop: '_max_temperature', type: 'value'},
            {id: 'min_humidity', prop: '_min_humidity', type: 'value'},
            {id: 'max_humidity', prop: '_max_humidity', type: 'value'},
            {id: 'leaf_temperature_offset', prop: '_leaf_temperature_offset', type: 'value'},
            {id: 'min_height', prop: '_min_height', type: 'value'},
            {id: 'is_bar_view', prop: '_is_bar_view', type: 'checked'},
            {id: 'enable_axes', prop: '_enable_axes', type: 'checked'},
            {id: 'enable_ghostclick', prop: '_enable_ghostclick', type: 'checked'},
            {id: 'enable_ghostmap', prop: '_enable_ghostmap', type: 'checked'},
            {id: 'enable_triangle', prop: '_enable_triangle', type: 'checked'},
            {id: 'enable_crosshair', prop: '_enable_crosshair', type: 'checked'},
            {id: 'enable_tooltip', prop: '_enable_tooltip', type: 'checked'},
            {id: 'enable_zoom', prop: '_enable_zoom', type: 'checked'},
            {id: 'enable_legend', prop: '_enable_legend', type: 'checked'},
            {id: 'enable_show_always_informations', prop: '_enable_show_always_informations', type: 'checked'},
            {id: 'ghostmap_hours', prop: '_ghostmap_hours', type: 'value'},
            {id: 'antialiasing', prop: '_antialiasing', type: 'value'},
            {id: 'unit_temperature', prop: '_unit_temperature', type: 'value'}
        ];
        configValues.forEach(({id, prop, type}) => {
            const el = this.shadowRoot.querySelector(`#${id}`);
            if (!el) return;
            if (type === 'checked') {
                el.checked = !!this[prop];
            } else {
                el.value = this[prop];
            }
        });
        requestAnimationFrame(() => this.updateMultiRange());
    }

    updateMultiRange() {
        const vpdPhases = this.config.vpd_phases;
        const slider = this.shadowRoot.querySelector('#slider-container');
        const ranges = this.generateRangesArray(vpdPhases);
        this.multiRange = new MultiRange(slider, {
            step: 0,
            min: this.toFixedNumber(vpdPhases[0].lower || 0),
            max: this.toFixedNumber(vpdPhases[vpdPhases.length - 1].lower + 0.6),
            ranges,
        });
        this.multiRange.on('changed', event => {
            if (event.detail.idx == null || event.detail.value == null) return;
            const cfg = this.copyConfig();
            const idx = event.detail.idx;
            const val = this.toFixedNumber(event.detail.value);
            if (cfg.vpd_phases[idx]) cfg.vpd_phases[idx].upper = val;
            if (cfg.vpd_phases[idx + 1]) cfg.vpd_phases[idx + 1].lower = val;
            this.config = cfg;
            this.fireEvent(this, 'config-changed', {config: cfg});
        });
    }

    initRooms() {
        const editor = this.shadowRoot.querySelector('.roomEditor');
        editor.innerHTML = '';
        editor.style.display = 'grid';
        editor.style.gridTemplateColumns = 'repeat(2,1fr)';
        editor.style.gap = '10px';
        const update = (i, prop, tgt) => {
            const cfg = this.copyConfig();
            cfg.rooms[i][prop] = this.checkValue(tgt);
            this.config = cfg;
            this.fireEvent(this, 'config-changed', {config: cfg});
        };
        this.config.rooms.forEach((room, i) => {
            const div = document.createElement('div');
            div.style = 'border:1px solid rgba(127,127,127,0.3);padding:5px;border-radius:15px;';
            const fields = [this.language.name, this.language.temperature_sensor + '*', this.language.leaf_temperature_sensor, this.language.humidity_sensor + '*'];
            const props = ['name', 'temperature', 'leaf_temperature', 'humidity'];
            fields.forEach((label, j) => {
                let el;
                if (props[j] === 'name') el = this.createTextField(label, i, room.name);
                else el = this.createComboBox(label, i, room[props[j]], props[j], props[j].includes('humidity') ? 'humidity' : 'temperature');
                el.addEventListener('value-changed', ev => update(i, props[j], ev));
                const deb = this.debounce((idx, p, tgt) => update(idx, p, tgt), 500);
                el.addEventListener('input', ev => deb(i, props[j], ev.target));
                div.appendChild(el);
            });
            const btn = document.createElement('button');
            btn.textContent = 'X';
            btn.className = 'removeButton';
            btn.addEventListener('click', () => {
                if (this.config.rooms.length === 1) return;
                const cfg = this.copyConfig();
                cfg.rooms.splice(i, 1);
                this.config = cfg;
                this.fireEvent(this, 'config-changed', {config: cfg});
                this.initRooms();
            });
            div.appendChild(btn);
            editor.appendChild(div);
        });
        const add = document.createElement('button');
        add.textContent = this.language.buttons.addRoom;
        add.className = 'addButton';
        add.addEventListener('click', () => {
            const cfg = this.copyConfig();
            cfg.rooms.push({name: '', temperature: '', leaf_temperature: '', humidity: ''});
            this.config = cfg;
            this.fireEvent(this, 'config-changed', {config: cfg});
            this.initRooms();
            editor.parentElement.parentElement.style.maxHeight = 'fit-content';
        });
        editor.appendChild(add);
    }

    initColorEditor() {
        const editor = this.shadowRoot.querySelector('.colorEditor');
        editor.innerHTML = '';
        editor.style.display = 'grid';
        editor.style.gridTemplateColumns = 'repeat(2,1fr)';
        editor.style.gap = '10px';
        this._vpd_phases.forEach((phase, i) => {
            const div = document.createElement('div');
            const tf = document.createElement('ha-textfield');
            tf.style = 'width:100%';
            tf.label = 'Phase ' + (i + 1);
            tf.dataset.index = i;
            tf.value = phase.className;
            tf.addEventListener('input', this.handleVPDPhaseChange);
            const cp = document.createElement('input');
            cp.type = 'color';
            cp.value = phase.color;
            cp.addEventListener('change', ev => {
                const cfg = this.copyConfig();
                cfg.vpd_phases[i].color = ev.target.value;
                this.multiRange.update(this.generateRangesArray(cfg.vpd_phases));
                this.config = cfg;
                this.fireEvent(this, 'config-changed', {config: cfg});
            });
            const rem = document.createElement('button');
            rem.textContent = 'X';
            rem.className = 'removeButton';
            rem.addEventListener('click', () => {
                if (this._vpd_phases.length === 1) return;
                const cfg = this.copyConfig();
                cfg.vpd_phases.splice(i, 1);
                this.config = cfg;
                this.fireEvent(this, 'config-changed', {config: cfg});
                this.multiRange.update(this.generateRangesArray(cfg.vpd_phases));
                this.initColorEditor();
                this.resortPhases();
                this.initAddButton();
            });
            div.append(tf, cp, rem);
            editor.appendChild(div);
        });
    }

    initAddButton() {
        const editor = this.shadowRoot.querySelector('.colorEditor');
        const existing = editor.querySelector('.addButton');
        if (existing) existing.remove();
        const add = document.createElement('button');
        add.textContent = this.language.buttons.addPhase;
        add.className = 'addButton';
        add.addEventListener('click', () => {
            const cfg = this.copyConfig();
            if (!cfg.vpd_phases.length) return;
            const last = cfg.vpd_phases[cfg.vpd_phases.length - 1];
            const lower = parseFloat(last.lower);
            const max = this.toFixedNumber(this.calculateVPD(this.config.max_temperature - this.config.leaf_temperature_offset, this.config.max_temperature, this.config.min_humidity));
            const newLower = this.toFixedNumber(lower + ((this.multiRange.settings.max - lower) / 2));
            last.upper = newLower;
            cfg.vpd_phases.push({lower: newLower, upper: max, className: 'phase-' + (cfg.vpd_phases.length + 1), color: '#' + Math.floor(Math.random() * 16777215).toString(16)});
            this.config = cfg;
            this.multiRange.update(this.generateRangesArray(cfg.vpd_phases));
            this.fireEvent(this, 'config-changed', {config: cfg});
            this.initColorEditor();
            this.initAddButton();
        });
        editor.appendChild(add);
    }

    generateRangesArray(phases) {
        return phases.map((p, i) => ({value: p.upper, color: phases[i + 1]?.color || null}));
    }

    resortPhases() {
        const cfg = this.copyConfig();
        cfg.vpd_phases.forEach((p, i) => {
            if (cfg.vpd_phases[i + 1]) cfg.vpd_phases[i + 1].lower = p.upper;
        });
        this.config = cfg;
        this.fireEvent(this, 'config-changed', {config: cfg});
    }

    initFormulaEditor() {
        const container = this.shadowRoot.querySelector('.formulaEditor');
        container.innerHTML = `
      <div>
        <p style="margin-bottom:10px;">Available Variables: Tleaf, Tair, RH</p>
        <textarea style="width:100%;height:100px;margin-top:10px;"></textarea>
      </div>`;
        const ta = container.querySelector('textarea');
        ta.value = this.config.calculateVPD || this.extractFunctionBody(this.calculateVPD);
        ta.addEventListener('input', ev => {
            this.config.calculateVPD = ev.target.value;
            this.fireEvent(this, 'config-changed', {config: this.config});
        });
    }

    extractFunctionBody(func) {
        const s = func.toString();
        return s.slice(s.indexOf('{') + 1, s.lastIndexOf('}'));
    }

    fireEvent(node, type, detail) {
        node.dispatchEvent(new CustomEvent(type, {detail, bubbles: true, composed: true}));
    }

    showGlobalTooltip(event) {
        const target = event.target.closest('ha-textfield, ha-formfield');
        if (target) {
            const title = target.getAttribute('data-helptext');
            if (title) {
                const tooltip = this.shadowRoot.getElementById('global-tooltip');
                tooltip.textContent = title;
                tooltip.style.display = 'block';
                tooltip.style.position = 'fixed';
                tooltip.style.backgroundColor = 'hsla(0, 0%, 20%, 0.9)';
                tooltip.style.color = 'white';
                tooltip.style.padding = '5px 10px';
                tooltip.style.borderRadius = '3px';
                tooltip.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
                tooltip.style.zIndex = '1000';
                tooltip.style.fontSize = "11px";
                tooltip.style.maxWidth = '250px';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.textAlign = 'center';

                let top = event.clientY + 15;
                let left = event.clientX + 10;

                tooltip.style.visibility = 'hidden';
                tooltip.style.top = '-9999px';
                tooltip.style.left = '-9999px';

                const tempRect = tooltip.getBoundingClientRect();
                const tooltipHeight = tempRect.height;
                const tooltipWidth = tempRect.width;

                if (top + tooltipHeight > window.innerHeight) {
                    top = event.clientY - tooltipHeight - 10;
                }
                if (left + tooltipWidth > window.innerWidth) {
                    left = event.clientX - tooltipWidth - 10;
                }

                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;
                tooltip.style.visibility = 'visible';
            } else {
                this.hideTooltipElement();
            }
        } else if (!event.relatedTarget || !event.relatedTarget.closest('#global-tooltip')) {
            this.hideTooltipElement();
        }
    }

    hideGlobalTooltip(event) {
        const relatedTarget = event.relatedTarget;
        const target = event.target.closest('ha-textfield, ha-formfield');

        if (target && (!relatedTarget || !target.contains(relatedTarget)) && (!relatedTarget || relatedTarget.id !== 'global-tooltip')) {
            this.hideTooltipElement();
        } else if (!target) {
            this.hideTooltipElement();
        }
    }

    hideTooltipElement() {
        const tooltip = this.shadowRoot.getElementById('global-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
            tooltip.textContent = '';
        }
    }
}

customElements.define('ha-vpd-chart-editor', HaVpdChartEditor);
Object.assign(HaVpdChartEditor.prototype, methods);
Object.assign(HaVpdChartEditor.prototype, MultiRange);
