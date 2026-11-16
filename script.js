
"use strict";

const cities = [
    { name: "Manila", lat: 14.5995, lon: 120.9842 },
    { name: "Cebu City", lat: 10.3157, lon: 123.8854 },
    { name: "Davao City", lat: 7.1907, lon: 125.4553 },
    { name: "Cagayan de Oro", lat: 8.4542, lon: 124.6319 },
    { name: "Malaybalay", lat: 8.1575, lon: 125.1278 }
];

const map = L.map("map").setView([11.2, 123.0], 6);

const baseMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(map);

const apiKeyInput = document.getElementById("apiKey");
const loadButton = document.getElementById("loadWeather");
const status = document.getElementById("status");
const weatherDetails = document.getElementById("weatherDetails");

const temperatureElement = document.getElementById("temperature");
const humidityElement = document.getElementById("humidity");
const windElement = document.getElementById("wind");
const pressureElement = document.getElementById("pressure");

const selectedCityElement = document.getElementById("selectedCity");
const descriptionElement = document.getElementById("weatherDescription");

const dashboardView = document.getElementById("dashboardView");
const locationView = document.getElementById("locationView");
const backToDashboard = document.getElementById("backToDashboard");

const locationTemperature = document.getElementById("locationTemperature");
const feelsLikeElement = document.getElementById("feelsLike");
const locationHumidity = document.getElementById("locationHumidity");
const locationWind = document.getElementById("locationWind");
const locationPressure = document.getElementById("locationPressure");
const visibilityElement = document.getElementById("visibility");
const cloudsElement = document.getElementById("clouds");
const localTimeElement = document.getElementById("localTime");
const timezoneElement = document.getElementById("timezone");
const sunriseElement = document.getElementById("sunrise");
const sunsetElement = document.getElementById("sunset");
const coordinatesElement = document.getElementById("coordinates");

const markers = {};
const weatherCache = new Map();

let selectedCity = null;
let selectedMarker = null;
let clickedMarker = null;
let activeRequest = 0;
let layerControl = null;
let weatherLayers = [];

const CACHE_MS = 10 * 60 * 1000;

function setStatus(message) {
    status.textContent = message;
}

function formatLocalTime(unixTime, timezoneOffset) {
    const localDate = new Date(
        (unixTime + timezoneOffset) * 1000
    );

    return new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC"
    }).format(localDate);
}

function formatTimezone(offset) {
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 3600);
    const minutes = Math.floor((Math.abs(offset) % 3600) / 60);

    return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function showDashboard() {
    dashboardView.classList.remove("hidden");
    locationView.classList.add("hidden");
}

function showLocationPanel() {
    dashboardView.classList.add("hidden");
    locationView.classList.remove("hidden");
}

function createMarker(city) {
    const marker = L.marker([city.lat, city.lon]).addTo(map);

    marker.bindTooltip(city.name);

    marker.on("click", () => {
        showWeather(city, marker);
    });

    markers[city.name] = marker;
}

cities.forEach(createMarker);

async function getCurrentWeather(city) {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        throw new Error("Please enter your OpenWeather API key.");
    }

    const cacheId =
        `${city.lat.toFixed(4)},${city.lon.toFixed(4)}|${apiKey}`;

    const saved = weatherCache.get(cacheId);

    if (saved && Date.now() - saved.time < CACHE_MS) {
        return saved.data;
    }

    const url = new URL(
        "https://api.openweathermap.org/data/2.5/weather"
    );

    url.searchParams.set("lat", city.lat);
    url.searchParams.set("lon", city.lon);
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", apiKey);

    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Invalid API key. Please check your key.");
        }

        if (response.status === 429) {
            throw new Error("API request limit reached. Try again later.");
        }

        throw new Error(`Weather request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.main || typeof data.main.temp !== "number") {
        throw new Error("Weather information is incomplete.");
    }

    weatherCache.set(cacheId, {
        time: Date.now(),
        data: data
    });

    return data;
}

function createWeatherCard(cityName, data, coordinates) {
    const card = document.createElement("div");
    card.className = "weather-card";

    const description =
        data.weather?.[0]?.description ?? "Not available";

    const icon = data.weather?.[0]?.icon ?? "";
    const timezone = data.timezone ?? 0;

    if (/^\d{2}[dn]$/.test(icon)) {
        const image = document.createElement("img");

        image.src =
            `https://openweathermap.org/img/wn/${icon}@2x.png`;

        image.alt = description;

        card.appendChild(image);
    }

    const info = document.createElement("div");

    function addDetail(label, value) {
        const detail = document.createElement("div");
        detail.textContent = `${label}: ${value}`;
        info.appendChild(detail);
    }

    const name = document.createElement("strong");
    name.textContent = cityName;
    info.appendChild(name);

    addDetail("Weather", description);
    addDetail("Temperature", `${data.main.temp.toFixed(1)} °C`);
    addDetail("Feels like", `${data.main.feels_like.toFixed(1)} °C`);
    addDetail("Humidity", `${data.main.humidity}%`);
    addDetail("Wind speed", `${data.wind?.speed ?? "N/A"} m/s`);
    addDetail("Pressure", `${data.main.pressure} hPa`);

    addDetail(
        "Visibility",
        data.visibility != null
            ? `${(data.visibility / 1000).toFixed(1)} km`
            : "N/A"
    );

    addDetail("Cloud coverage", `${data.clouds?.all ?? "N/A"}%`);

    addDetail(
        "Current local time",
        `${formatLocalTime(Date.now() / 1000, timezone)} (${formatTimezone(timezone)})`
    );

    if (data.sys?.sunrise) {
        addDetail(
            "Sunrise",
            formatLocalTime(data.sys.sunrise, timezone)
        );
    }

    if (data.sys?.sunset) {
        addDetail(
            "Sunset",
            formatLocalTime(data.sys.sunset, timezone)
        );
    }

    if (coordinates) {
        addDetail(
            "Coordinates",
            `${coordinates.lat.toFixed(4)}, ${coordinates.lon.toFixed(4)}`
        );
    }

    card.appendChild(info);

    return card;
}

function updateLocationPanel(cityName, data, coordinates) {
    selectedCityElement.textContent = cityName;

    descriptionElement.textContent =
        data.weather?.[0]?.description ?? "Weather unavailable";

    locationTemperature.textContent =
        `${data.main.temp.toFixed(1)} °C`;

    feelsLikeElement.textContent =
        `${data.main.feels_like.toFixed(1)} °C`;

    locationHumidity.textContent =
        `${data.main.humidity}%`;

    locationWind.textContent =
        `${data.wind?.speed ?? "N/A"} m/s`;

    locationPressure.textContent =
        `${data.main.pressure} hPa`;

    visibilityElement.textContent =
        data.visibility != null
            ? `${(data.visibility / 1000).toFixed(1)} km`
            : "N/A";

    cloudsElement.textContent =
        `${data.clouds?.all ?? "N/A"}%`;

    const timezone = data.timezone ?? 0;

    localTimeElement.textContent =
        formatLocalTime(Date.now() / 1000, timezone);

    timezoneElement.textContent =
        formatTimezone(timezone);

    sunriseElement.textContent =
        data.sys?.sunrise
            ? formatLocalTime(data.sys.sunrise, timezone)
            : "N/A";

    sunsetElement.textContent =
        data.sys?.sunset
            ? formatLocalTime(data.sys.sunset, timezone)
            : "N/A";

    coordinatesElement.textContent =
        `${coordinates.lat.toFixed(4)}, ${coordinates.lon.toFixed(4)}`;
}

function updateMarker(marker, data) {
    if (!marker) return;

    const temperature = Math.round(data.main.temp);

    const icon = L.divIcon({
        className: "",
        html: `<div class="weather-marker">${temperature}°C</div>`,
        iconSize: [65, 35],
        iconAnchor: [32, 17]
    });

    marker.setIcon(icon);
}

async function showWeather(city, marker) {
    const requestId = ++activeRequest;

    selectedCity = city;
    selectedMarker = marker;

    showLocationPanel();

    selectedCityElement.textContent = city.name;
    descriptionElement.textContent = "Loading weather information...";

    setStatus(`Getting weather for ${city.name}...`);

    try {
        const data = await getCurrentWeather(city);

        if (requestId !== activeRequest) return;

        const cityName = city.name || data.name || "Selected location";

        updateLocationPanel(cityName, data, city);
        updateMarker(marker, data);

        const popup = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = cityName;

        const temperature = document.createElement("p");
        temperature.textContent =
            `${data.main.temp.toFixed(1)} °C`;

        const condition = document.createElement("p");
        condition.textContent =
            data.weather?.[0]?.description ?? "Weather unavailable";

        const localTime = document.createElement("p");
        localTime.textContent =
            `Local time: ${formatLocalTime(Date.now() / 1000, data.timezone ?? 0)}`;

        popup.append(title, temperature, condition, localTime);

        marker.bindPopup(popup).openPopup();

        setStatus(`Current weather loaded for ${cityName}.`);

    } catch (error) {
        if (requestId !== activeRequest) return;

        setStatus(error.message);
        descriptionElement.textContent = error.message;
    }
}

map.on("click", event => {
    const location = {
        name: "Selected location",
        lat: event.latlng.lat,
        lon: event.latlng.lng
    };

    if (clickedMarker) {
        map.removeLayer(clickedMarker);
    }

    clickedMarker = L.marker(event.latlng).addTo(map);

    clickedMarker.bindTooltip("Selected location");

    showWeather(location, clickedMarker);
});

function setupWeatherLayers(apiKey) {
    if (layerControl) {
        map.removeControl(layerControl);
    }

    weatherLayers.forEach(layer => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    const layerTypes = {
        "Temperature": "temp_new",
        "Precipitation": "precipitation_new",
        "Cloud Coverage": "clouds_new",
        "Wind Speed": "wind_new"
    };

    const overlays = {};

    weatherLayers = [];

    Object.entries(layerTypes).forEach(([name, type]) => {
        const layer = L.tileLayer(
            `https://tile.openweathermap.org/map/${type}/{z}/{x}/{y}.png?appid=${encodeURIComponent(apiKey)}`,
            {
                opacity: 0.65,
                attribution: "&copy; OpenWeather",
                maxZoom: 19
            }
        );

        overlays[name] = layer;
        weatherLayers.push(layer);
    });

    layerControl = L.control.layers(
        { "Standard Map": baseMap },
        overlays,
        { collapsed: false }
    ).addTo(map);
}

function renderDashboard(results) {
    const successfulResults = results
        .map((result, index) => ({
            result,
            city: cities[index]
        }))
        .filter(item => item.result.status === "fulfilled");

    if (successfulResults.length === 0) {
        return;
    }

    const average = key => {
        const values = successfulResults.map(item => {
            if (key === "wind") {
                return item.result.value.wind?.speed ?? 0;
            }

            return item.result.value.main[key];
        });

        return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    temperatureElement.textContent =
        `${average("temp").toFixed(1)} °C`;

    humidityElement.textContent =
        `${Math.round(average("humidity"))}%`;

    windElement.textContent =
        `${average("wind").toFixed(1)} m/s`;

    pressureElement.textContent =
        `${Math.round(average("pressure"))} hPa`;

    const cards = successfulResults.map(item =>
        createWeatherCard(
            item.city.name,
            item.result.value,
            item.city
        )
    );

    weatherDetails.replaceChildren(...cards);
}

async function loadAllWeather() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        setStatus("Please enter your OpenWeather API key first.");
        return;
    }

    loadButton.disabled = true;
    loadButton.textContent = "Loading...";

    activeRequest++;
    selectedCity = null;
    selectedMarker = null;

    if (clickedMarker) {
        map.removeLayer(clickedMarker);
        clickedMarker = null;
    }

    weatherCache.clear();

    setupWeatherLayers(apiKey);

    setStatus("Loading weather for all cities...");

    const results = await Promise.allSettled(
        cities.map(city => getCurrentWeather(city))
    );

    let successful = 0;

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            updateMarker(markers[cities[index].name], result.value);
            successful++;
        }
    });

    loadButton.disabled = false;
    loadButton.textContent = "Load Weather";

    if (successful === 0) {
        setStatus("Unable to load weather. Check your API key.");
        return;
    }

    renderDashboard(results);
    showDashboard();

    setStatus(
        `Weather loaded for ${successful} out of ${cities.length} cities.`
    );
}

backToDashboard.addEventListener("click", () => {
    activeRequest++;
    selectedCity = null;
    selectedMarker = null;

    showDashboard();
    setStatus("Dashboard view.");
});

loadButton.addEventListener("click", loadAllWeather);

showDashboard();
