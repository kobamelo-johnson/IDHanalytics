// --- START: PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyCsmqw1kqZdMWJuFp8DLKhOkuYtNNIxlzs",
    authDomain: "voiceflow-analytics-87df7.firebaseapp.com",
    projectId: "voiceflow-analytics-87df7",
    storageBucket: "voiceflow-analytics-87df7.firebasestorage.app",
    messagingSenderId: "1013888968601",
    appId: "1:1013888968601:web:23f50429f67196defb9508"
};
// --- END: PASTE YOUR FIREBASE CONFIG HERE ---

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DOM ELEMENT REFERENCES ---
const navAnalyticsBtn = document.getElementById('nav-analytics');
const navUsersBtn = document.getElementById('nav-users');
const analyticsView = document.getElementById('analytics-view');
const userListView = document.getElementById('user-list-view');
const searchBox = document.getElementById('search-box');
const userTableBody = document.getElementById('user-table-body');
const loadingIndicator = document.getElementById('loading-users');
const kpiTotalUsers = document.getElementById('kpi-total-users');
const downloadCsvBtn = document.getElementById('download-csv-btn');

// --- GLOBAL STATE ---
let allUsers = [];
let currentlyDisplayedUsers = [];
let completionRateChart, statusChart, funnelChart, dailyActivityChart, preferencePieChart;
let isInitialLoad = true;

// --- FUNNEL STAGES CONSTANT ---
const FUNNEL_STAGES = [
    'ID Number Entered', 'Preference Selected', 
    'Full Name Entered', 'Email Address Entered', 'Phone Number Entered', 'Completed'
];

// --- MAIN REAL-TIME DATA LISTENER ---
db.collection("users").orderBy("last_update_time", "desc").onSnapshot(snapshot => {
    allUsers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => parseInt(doc.id) > 0);

    loadingIndicator.style.display = 'none';
    
    renderAnalytics(allUsers);
    
    const currentSearch = searchBox.value;
    if (isInitialLoad || !currentSearch.startsWith("Filter:")) {
        renderUserList(currentSearch ? filterUsers(currentSearch) : allUsers);
    } else {
        renderUserList(filterUsers(currentSearch));
    }
    isInitialLoad = false;

}, error => {
    console.error("Error fetching users: ", error);
    loadingIndicator.innerText = "Error loading data.";
});

// --- RENDER FUNCTIONS ---
function renderAnalytics(users) {
    const totalUsers = users.length;
    kpiTotalUsers.innerText = totalUsers;

    const completedUsersCount = users.filter(u => u.status === 'Opted-In').length;
    const inProgressUsersCount = totalUsers - completedUsersCount;
    const completionRate = totalUsers > 0 ? Math.round((completedUsersCount / totalUsers) * 100) : 0;
    
    const stageCounts = FUNNEL_STAGES.map(stage => users.filter(u => FUNNEL_STAGES.indexOf(u.last_completed_step) >= FUNNEL_STAGES.indexOf(stage)).length);
    const dailyData = processDailyData(users);
    const preferenceData = processPreferenceData(users);

    renderCompletionChart(completionRate);
    renderStatusChart(completedUsersCount, inProgressUsersCount);
    renderFunnelChart(stageCounts);
    renderDailyActivityChart(dailyData.labels, dailyData.data);
    renderPreferenceChart(preferenceData.labels, preferenceData.data);
}

function renderUserList(usersToRender) {
    currentlyDisplayedUsers = usersToRender;
    userTableBody.innerHTML = '';
    if (usersToRender.length === 0) {
        const message = allUsers.length > 0 ? "No users match your search or filter." : "No permanent user data yet.";
        userTableBody.innerHTML = `<tr><td colspan="4" class="loading">${message}</td></tr>`;
        return;
    }

    usersToRender.forEach(user => {
        const stageIndex = FUNNEL_STAGES.indexOf(user.last_completed_step);
        const progressPercent = stageIndex >= 0 ? ((stageIndex + 1) / FUNNEL_STAGES.length) * 100 : 0;
        
        const isReEngaged = user.status === 'Opted-In' && user.last_completed_step !== 'Completed';
        const statusHTML = `
            <span class="${user.status === 'Opted-In' ? 'status-completed' : 'status-started'}">${user.status || 'In Progress'}</span>
            ${isReEngaged ? '<span class="status-badge">Re-engaged</span>' : ''}
        `;

        userTableBody.innerHTML += `
            <tr class="main-row">
                <td>${user.id}</td>
                <td>${user.last_completed_step || 'Unknown'}</td>
                <td>${statusHTML}</td>
                <td>${user.last_update_time ? new Date(user.last_update_time.seconds * 1000).toLocaleString() : 'N/A'}</td>
            </tr>
            <tr class="details-row">
                <td colspan="4"><div class="details-outer-container"><div class="details-inner-container">
                    <div><h4>User Progress</h4><div class="progress-bar-container"><div class="progress-bar" style="width: ${progressPercent}%;"></div></div><p style="margin-top: 10px; color: var(--text-secondary);">${user.last_completed_step}</p></div>
                    <div><h4>Captured Information</h4><div class="info-grid">
                        <div class="info-item"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg></div><div><span>Full Name</span><div class="data">${user.full_name || '...'}</div></div></div>
                        <div class="info-item"><div class="icon"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></svg></div><div><span>Email</span><div class="data">${user.email_address || '...'}</div></div></div>
                        <div class="info-item"><div class="icon"><svg viewBox="0 0 24 24"><path d="M3 4c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V4zm2 0v16h14V4H5zm2 2h10v2H7V6zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"></path></svg></div><div><span>ID Number</span><div class="data">${user.id_number || '...'}</div></div></div>
                        <div class="info-item"><div class="icon"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"></path></svg></div><div><span>WhatsApp</span><div class="data">${user.phone_number || '...'}</div></div></div>
                    </div></div>
                </div></div></td>
            </tr>
        `;
    });
}

// --- DATA PROCESSING & CHARTING ---
function formatDate(timestamp) {
    if (!timestamp || !timestamp.seconds) return null;
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
}

function processDailyData(users) {
    const dailyCounts = {};
    users.forEach(user => {
        const date = formatDate(user.last_update_time);
        if (date) { dailyCounts[date] = (dailyCounts[date] || 0) + 1; }
    });
    const sortedDates = Object.keys(dailyCounts).sort();
    return { labels: sortedDates, data: sortedDates.map(date => dailyCounts[date]) };
}

function processPreferenceData(users) {
    const prefCounts = { 'whatsapp': 0, 'email': 0, 'both': 0 };
    users.forEach(user => {
        if (user.preference && prefCounts.hasOwnProperty(user.preference)) {
            prefCounts[user.preference]++;
        }
    });
    return {
        labels: ['WhatsApp', 'Email', 'Both'],
        data: [prefCounts.whatsapp, prefCounts.email, prefCounts.both]
    };
}

const apexChartOptions = {
    chart: { toolbar: { show: false }, animations: { easing: 'easeOut', speed: 800 }, foreColor: '#94a3b8' },
    tooltip: { theme: 'dark' }
};

function renderChart(chartInstance, options, selector) {
    if (!chartInstance) {
        chartInstance = new ApexCharts(document.querySelector(selector), options);
        chartInstance.render();
    } else {
        chartInstance.updateOptions(options);
    }
    return chartInstance;
}

function renderCompletionChart(rate) {
    const options = { ...apexChartOptions, series: [rate], chart: { type: 'radialBar', height: '100%', sparkline: { enabled: true } }, plotOptions: { radialBar: { hollow: { size: '70%' }, track: { background: 'rgba(148, 163, 184, 0.2)' }, dataLabels: { name: { show: false }, value: { color: '#e2e8f0', fontSize: '2em', fontFamily: 'Poppins', fontWeight: 600, offsetY: 8 } } } }, fill: { colors: ['#39ff14'] }, stroke: { lineCap: "round" }, labels: ['Rate'], };
    completionRateChart = renderChart(completionRateChart, options, "#completion-rate-chart");
}

function renderStatusChart(completed, inProgress) {
    const options = { ...apexChartOptions, series: [completed, inProgress], chart: { type: 'donut', height: '100%', sparkline: { enabled: true } }, labels: ['Completed', 'In Progress'], colors: ['#39ff14', '#00c6ff'], legend: { show: false }, dataLabels: { enabled: false }, plotOptions: { pie: { donut: { size: '80%', background: 'transparent' } } }, stroke: { show: false }, };
    statusChart = renderChart(statusChart, options, "#status-chart");
}

function renderFunnelChart(data) {
    const options = { ...apexChartOptions, series: [{ name: 'Users', data }],
        chart: { type: 'bar', height: 350, events: { dataPointSelection: (event, chartContext, config) => {
            const clickedStage = FUNNEL_STAGES[config.dataPointIndex];
            const filterTag = `Filter: Users who stopped at "${clickedStage}"`;
            applyFilterAndSwitchView(filterTag);
        }}},
        plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '50%' } },
        colors: ['#00c6ff'], grid: { borderColor: 'var(--border-color)' },
        dataLabels: { enabled: true, formatter: (val) => `${val}`, style: { colors: ['#fff'], fontFamily: 'Poppins', fontWeight: '500' }, offsetY: -20, },
        xaxis: { categories: FUNNEL_STAGES },
        yaxis: { title: { text: '% of Total Users' },
            labels: { formatter: (val) => {
                const totalUsers = allUsers.length || 1;
                const percent = ((val / totalUsers) * 100).toFixed(0);
                return `${percent}%`;
            }}},
    };
    funnelChart = renderChart(funnelChart, options, "#funnel-chart");
}

function renderDailyActivityChart(labels, data) {
    const options = { ...apexChartOptions, series: [{ name: 'Active Users', data }],
        chart: { type: 'area', height: 350, zoom: { enabled: false }, events: { dataPointSelection: (event, chartContext, config) => {
            const clickedDate = labels[config.dataPointIndex];
            const filterTag = `Filter: Users active on "${clickedDate}"`;
            applyFilterAndSwitchView(filterTag);
        }}},
        dataLabels: { enabled: false }, stroke: { curve: 'smooth' },
        colors: ['#39ff14'], grid: { borderColor: 'var(--border-color)' },
        xaxis: { type: 'datetime', categories: labels, },
        yaxis: { title: { text: 'Number of Active Users' }},
    };
    dailyActivityChart = renderChart(dailyActivityChart, options, "#daily-activity-chart");
}

function renderPreferenceChart(labels, data) {
    const options = { ...apexChartOptions, series: data,
        chart: { type: 'donut', height: 350, events: { dataPointSelection: (event, chartContext, config) => {
            const preference = labels[config.dataPointIndex];
            const filterTag = `Filter: Users who chose "${preference}"`;
            applyFilterAndSwitchView(filterTag);
        }}},
        labels: labels,
        colors: ['#25D366', 'var(--brand-blue)', 'var(--accent-purple)'],
        legend: { position: 'bottom' },
        plotOptions: { pie: { donut: { size: '65%' } } }
    };
    preferencePieChart = renderChart(preferencePieChart, options, "#preference-pie-chart");
}

// --- EVENT HANDLERS & NAVIGATION ---
function switchToView(viewName) {
    analyticsView.classList.toggle('active', viewName === 'analytics');
    userListView.classList.toggle('active', viewName === 'users');
    navAnalyticsBtn.classList.toggle('active', viewName === 'analytics');
    navUsersBtn.classList.toggle('active', viewName === 'users');
}

// THIS IS THE FINAL, ROBUST FILTER FUNCTION
function filterUsers(searchTerm) {
    const term = searchTerm.toLowerCase();
    if (term.startsWith("filter:")) {
        const filterValue = term.substring(term.indexOf('"') + 1, term.lastIndexOf('"')).toLowerCase();
        
        if (term.includes('stopped at')) {
            return allUsers.filter(user => user.last_completed_step && user.last_completed_step.toLowerCase() === filterValue);
        } else if (term.includes('active on')) {
            return allUsers.filter(user => formatDate(user.last_update_time) === filterValue);
        } else if (term.includes('who chose')) {
            return allUsers.filter(user => user.preference && user.preference.toLowerCase() === filterValue);
        }
    }
    // Standard text search
    return allUsers.filter(user => Object.values(user).some(val => String(val).toLowerCase().includes(term)));
}

// Helper function to apply a filter and switch views
function applyFilterAndSwitchView(filterTag) {
    searchBox.value = filterTag;
    renderUserList(filterUsers(filterTag));
    switchToView('users');
}

function downloadAsCsv() {
    if (currentlyDisplayedUsers.length === 0) {
        alert("No data to download.");
        return;
    }
    const headers = ["User ID", "ID Number", "Full Name", "Email", "Phone Number", "Preferred Channel", "Status", "Furthest Step"];
    const csvRows = [headers.join(',')];
    currentlyDisplayedUsers.forEach(user => {
        const row = [
            `"${user.id || ''}"`,
            `"${user.id_number || ''}"`,
            `"${user.full_name || ''}"`,
            `"${user.email_address || ''}"`,
            `"${user.phone_number || ''}"`,
            `"${user.preference || ''}"`,
            `"${user.status || ''}"`,
            `"${user.last_completed_step || ''}"`
        ];
        csvRows.push(row.join(','));
    });
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let filename = 'User_Data.csv';
    const searchTerm = searchBox.value;
    if (searchTerm.startsWith("Filter:")) {
        filename = searchTerm.replace('Filter: ', '').replace(/"/g, '') + '.csv';
    } else if (searchTerm) {
        filename = `Search_Results_for_${searchTerm}.csv`;
    }
    a.setAttribute('href', url);
    a.setAttribute('download', filename.replace(/[\s/]/g, '_'));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Attaching all event listeners ---
navAnalyticsBtn.addEventListener('click', () => switchToView('analytics'));
navUsersBtn.addEventListener('click', () => {
    if (searchBox.value.startsWith("Filter:")) {
        searchBox.value = "";
        renderUserList(allUsers);
    }
    switchToView('users');
});
searchBox.addEventListener('input', (e) => renderUserList(filterUsers(e.target.value)));
downloadCsvBtn.addEventListener('click', downloadAsCsv);
userTableBody.addEventListener('click', (e) => {
    const mainRow = e.target.closest('.main-row');
    if (mainRow) {
        const detailsRow = mainRow.nextElementSibling;
        if (detailsRow) detailsRow.style.display = (detailsRow.style.display === 'table-row') ? 'none' : 'table-row';
    }
});

switchToView('analytics');