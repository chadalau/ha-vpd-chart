# HaVpdChart for Home Assistant

![HaVpdChart Image](https://github.com/mentalilll/ha-vpd-chart/blob/main/assets/startscreen.gif?raw=true)

![HaVpdChart Image](https://github.com/mentalilll/ha-vpd-chart/blob/main/assets/bar_view.png?raw=true)

![HaVpdChart Image](https://github.com/mentalilll/ha-vpd-chart/blob/main/assets/bar_view_light.png?raw=true)

![HaVpdChart Image](https://github.com/mentalilll/ha-vpd-chart/blob/main/assets/settings.png?raw=true)

`HaVpdChart` is a custom card component for Home Assistant that allows for visual representations of VPD (Vapour Pressure Deficit) based on temperature and humidity sensors. It's ideal for monitoring environmental conditions in tents or rooms.

## Prerequisites

* A running Home Assistant installation.
* Basic understanding of Home Assistant configuration (including YAML).

## Installation

There are two main ways to install the `HaVpdChart` card: via HACS (recommended) or manually.

### Method 1: HACS Installation (Recommended)

If you don't have [HACS (Home Assistant Community Store)](https://hacs.xyz) installed yet, follow their official installation guide first.

1. **Add Custom Repository:**
    * Open HACS in your Home Assistant instance.
    * Click on `Frontend`.
    * Click the three-dot menu in the top-right corner and select `Custom repositories`.
    * In the dialog:
        * Enter the Repository URL: `https://github.com/mentalilll/ha-vpd-chart`
        * Select the Category: `Lovelace`
        * Click `Add`.
2. **Install Plugin:**
    * Close the `Custom repositories` dialog.
    * Search for `HaVpdChart` in the HACS Frontend section.
    * Click on the `HaVpdChart` entry.
    * Click `Download` and follow the prompts to install the card.
3. **Add to Dashboard:**
    * Follow the [Usage](#usage) instructions below to add the card to your Lovelace dashboard.

### Method 2: Manual Installation (from GitHub)

1. **Download the Release:**
    * Go to the [Releases page](https://github.com/mentalilll/ha-vpd-chart/releases) of the `ha-vpd-chart` repository.
    * Download the `ha-vpd-chart.js` file from the latest release assets.
2. **Upload to Home Assistant:**
    * Navigate to your Home Assistant configuration directory (often called `config`).
    * If they don't exist, create the directories `www/community/ha-vpd-chart/`. The full path would be `<config>/www/community/ha-vpd-chart/`.
    * Copy the downloaded `ha-vpd-chart.js` file into this `ha-vpd-chart` directory.
3. **Add Resource Reference:**
    * In the Home Assistant UI, navigate to `Configuration` -> `Lovelace Dashboards`.
    * Click the `Resources` tab (or the three-dot menu and then `Resources` if you only have one dashboard).
    * *Alternatively*, if you don't see the UI option, navigate directly to `http://<your_homeassistant_ip>:8123/config/lovelace/resources`.
    * Click `Add Resource`.
    * Enter the following details:
        * **URL:** `/local/community/ha-vpd-chart/ha-vpd-chart.js` (Note: `/local` maps to the `www` directory).
        * **Resource Type:** `JavaScript Module`.
    * Click `Create`.
4. **Restart (Optional but Recommended):**
    * Restart Home Assistant to ensure the resource is loaded correctly. A browser cache refresh (Ctrl+F5 or Cmd+Shift+R) might also be needed.
5. **Add to Dashboard:**
    * Follow the [Usage](#usage) instructions below.

## Usage

You can configure the `HaVpdChart` card using the visual UI editor or by using YAML.

1. Navigate to the Lovelace dashboard where you want to add the card.
2. Enter `Edit Dashboard` mode.
3. Click `Add Card`.
4. Search for `Custom: VPD Chart` and select it.
5. Configure the card options through the visual editor.

Alternatively, you can use the YAML configuration:

Easy start as Chart View:

```yaml
type: custom:ha-vpd-chart
rooms:
  - temperature: sensor.temperature_2
    humidity: sensor.humidity_2
    name: Tent 1
  - temperature: sensor.temperature_tent_2
    humidity: sensor.humidity_tent_2
    name: Tent 2
```

Easy start for Fahrenheit Chart View:

***Attention: your sensor needs to have °F as unit of measurement***

```yaml
type: custom:ha-vpd-chart
rooms:
  - name: Raum 2
    temperature: input_number.test_temp_2
    humidity: input_number.test_rh_2
    leaf_temperature: input_number.test_leaf_temp_2
min_temperature: 40
max_temperature: 96
min_humidity: 26
max_humidity: 90
```

Easy start as Bar View:

```yaml
type: custom:ha-vpd-chart
is_bar_view: true
rooms:
  - temperature: sensor.temperature_2
    humidity: sensor.humidity_2
    name: Tent 1
  - temperature: sensor.temperature_tent_2
    humidity: sensor.humidity_tent_2
    name: Tent 2
```

To use the `HaVpdChart` in your Lovelace dashboard, add the following configuration to your dashboard. Adjust the rooms and other options according to your setup:

```yaml
type: custom:ha-vpd-chart
air_text: Temp. #optional "" for Empty
rh_text: r.H. #optional "" for Empty
min_temperature: 5 #optional
max_temperature: 35 #optional
min_humidity: 10 #optional
max_humidity: 100 #optional
min_height: 200 #optional (minimum height of the chart as px)
is_bar_view: false #optional
enable_tooltip: true #optional
enable_axes: true #optional
enable_ghostmap: true #optional
enable_triangle: true #optional
enable_crosshair: true #optional
enable_zoom: true #optional
enable_show_always_informations: true #optional
enable_legend: true #optional
leaf_temperature_offset: 2 || input_number.leaf_offset_example #optional
rooms:
  - temperature: sensor.temperature_2
    humidity: sensor.humidity_2
    leaf_temperature: sensor.infrared_sensor #optional
    name: Tent 1
  - temperature: sensor.temperature_tent_2
    humidity: sensor.humidity_tent_2
    name: Tent 2
vpd_phases: #optional
  - upper: 0.0
    className: gray-danger-zone
    color: #999999
  - lower: 0.0
    upper: 0.4
    className: under-transpiration
    color: #0000FF
  - lower: 0.4
    upper: 0.8
    className: early-veg
  - lower: 0.8
    upper: 1.2
    className: late-veg
  - lower: 1.2
    upper: 1.6
    className: mid-late-flower
  - lower: 1.6
    className: danger-zone
calculateVPD: |2-
          const VPleaf = 610.7 * Math.exp(17.27 * Tleaf / (Tleaf + 237.3)) / 1000; 
          const VPair = 610.7 * Math.exp(17.27 * Tair / (Tair + 237.3)) / 1000 * RH / 100;
          return VPleaf - VPair;
```

## Configuration Parameters

| Name                            | Type           | Required     | Default                                 | Description                                                                                       |
|---------------------------------|----------------|--------------|-----------------------------------------|---------------------------------------------------------------------------------------------------|
| type                            | string         | **required** |                                         | Must be `custom:ha-vpd-chart`.                                                                    |
| air_text                        | string         | optional     | `Air`                                   | The text used for temperature readings. Default is "Air".                                         |
| rh_text                         | string         | optional     | `RH`                                    | The text used for humidity readings. Default is "RH".                                             |
| kpa_text                        | string         | optional     | `kPa`                                   | The text used for kPa readings. Default is "kPa".                                                 |
| min_temperature                 | number         | optional     | `5`                                     | Minimum temperature in the chart. Default is 5.                                                   |
| min_humidity                    | number         | optional     | `10`                                    | Minimum humidity in the chart. Default is 10.                                                     |
| max_temperature                 | number         | optional     | `35`                                    | Maximum temperature in the chart. Default is 35.                                                  |
| max_humidity                    | number         | optional     | `90`                                    | Maximum humidity in the chart. Default is 90.                                                     |
| min_height                      | number         | optional     | `200`                                   | Minimum height of the chart as px. Default is 200.                                                |
| leaf_temperature_offset         | number\|string | optional     | `2`\|`input_number.leaf_offset_example` | Sets the Temperature Offset of the Leaf                                                           |                                                                                                     |
| rooms                           | list           | **required** |                                         | A list of rooms with their temperature and humidity entity IDs, and an optional name for display. |
| vpd_phases                      | list           | optional     | See description                         | A list of VPD phases and their classes for visual representation. See below for defaults.         |
| enable_tooltip                  | boolean        | optional     | `true`                                  | Tooltip enabled by default.                                                                       |
| is_bar_view                     | boolean        | optional     | `true`                                  | Enable Bar view of this chart for fast information of sensors                                     |
| enable_axes                     | boolean        | optional     | `true`                                  | Enable Axes on the Chart                                                                          |
| enable_ghostmap                 | boolean        | optional     | `true`                                  | Enable Ghostmap on the Chart                                                                      |
| enable_ghostclick               | boolean        | optional     | `true`                                  | Enable Ghostclick instead of Hover                                                                |
| enable_triangle                 | boolean        | optional     | `true`                                  | Enable Triangle instead of Circle for tooltip marker                                              |
| enable_crosshair                | boolean        | optional     | `true`                                  | Enable MouseHover Crosshair                                                                       |
| enable_zoom                     | boolean        | optional     | `true`                                  | Enable zoom function for chart                                                                    |
| enable_show_always_informations | boolean        | optional     | `true`                                  | Enable show always tooltip informations for chart                                                 |
| enable_legend                   | boolean        | optional     | `true`                                  | Enable Legend function for chart                                                                  |
| calculateVPD                    | string         | optional     | See description                         | Custom function to calculate VPD.                                                                 |

**Template for VPD Sensor History**

ATTENTION: EDIT THE YOUR_*_SENSOR PARTS WITH YOUR SENSOR NAMES!

```yaml
sensor:
  - platform: template
    sensors:
      gd_vpd:
        icon_template: 'mdi:water-percent'
        unit_of_measurement: kPa
        value_template: |

          {% set T = states('sensor.YOUR_TEMPERATURE_SENSOR')|float %}
          {% set RH = states('sensor.YOUR_HUMIDITY_SENSOR')|float %}
          {% set SVP = 0.61078 * e ** (T / (T + 237.3) * 17.2694) %}
          {% set VPD = SVP * ((100 - RH) / 100) %}
          {{ VPD | round(2) }}
  - platform: template
    sensors:
      gd_vpd_leaf:
        icon_template: 'mdi:leaf'
        unit_of_measurement: kPa
        value_template: >
          {% set T = states('sensor.YOUR_TEMPERATURE_SENSOR')|float %}
          {% set RH = states('sensor.YOUR_HUMIDITY_SENSOR')|float %}
          {% set LT = states('sensor.YOUR_TEMPERATURE_SENSOR')|float - 2 %} # OR {% set LT = states('sensor.YOUR_INFRARED_SENSOR')|float %} 
          {% set ASVP = 0.61078 * e ** (T / (T + 237.3) * 17.2694) %}
          {% set LSVP = 0.61078 * e ** (LT / (LT + 237.3) * 17.2694) %}
          {% set LVPD = LSVP - (ASVP * RH / 100) %}

          {{ LVPD | round(2) }}
```

**Default `vpd_phases` Configuration:**

- `under-transpiration`: VPD < 0.4
- `early-veg`: 0.4 ≤ VPD < 0.8
- `late-veg`: 0.8 ≤ VPD < 1.2
- `mid-late-flower`: 1.2 ≤ VPD < 1.6
- `danger-zone`: VPD ≥ 1.6
