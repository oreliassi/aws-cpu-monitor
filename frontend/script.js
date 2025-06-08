document.addEventListener('DOMContentLoaded', function () {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('startDate').setAttribute('max', today);
  document.getElementById('endDate').setAttribute('max', today);

  const timeElems = document.querySelectorAll('.timepicker');
  M.Timepicker.init(timeElems, {
    twelveHour: false,
    defaultTime: 'now',
    showClearBtn: true
  });

  const dateElems = document.querySelectorAll('.datepicker');
  M.Datepicker.init(dateElems, {
    format: 'yyyy-mm-dd',
    autoClose: true
  });
});

const form = document.getElementById('cpuForm');
const ctx = document.getElementById('cpuChart').getContext('2d');
let chart;

function mergeDateTime(dateStr, timeStr) {
  return new Date(dateStr + 'T' + timeStr).toISOString();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const ip = document.getElementById('ip').value;
  const ipRegex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
  if (!ipRegex.test(ip)) {
  alert("Invalid IP address format.");
  return;
  }
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const startTime = document.getElementById('startClock').value;
  const endTime = document.getElementById('endClock').value;
  const period = parseInt(document.getElementById('period').value);

  if (!startDate || !endDate || !startTime || !endTime) {
    alert("Please fill in all date and time fields.");
    return;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    alert("Invalid date format. Use yyyy-mm-dd.");
    return;
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    alert("Invalid time format. Use HH:MM (24h).");
    return;
  }

  const yearStart = parseInt(startDate.split('-')[0]);
  const yearEnd = parseInt(endDate.split('-')[0]);
  const currentYear = new Date().getFullYear();
  if (yearStart > currentYear || yearEnd > currentYear) {
    alert("Selected year is in the future. Please select a valid date.");
    return;
  }

  if (isNaN(period) || period < 10 || period > 3600) {
    alert("Period must be a number between 10 and 3600 seconds.");
    return;
  }

  const startISO = mergeDateTime(startDate, startTime);
  const endISO = mergeDateTime(endDate, endTime);
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (start >= end) {
    alert("Start time must be before end time.");
    return;
  }

  const secondsRange = (end - start) / 1000;
  const maxPoints = 1440;
  const estimatedPoints = secondsRange / period;

  if (estimatedPoints > maxPoints) {
    alert("Too many data points requested. Try increasing the period (seconds) or reducing the time range.");
    return;
  }

  try {

    document.getElementById("loadingSpinner").style.display = "block";

    const response = await fetch('/api/cpu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip,
        startTime: startISO,
        endTime: endISO,
        period
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get CPU data. Try reducing the time range or increasing the period.');
    }

    const data = await response.json();
    const { timestamps, values } = data;

    if (chart) chart.destroy();

    const maxValue = Math.max(...values);
    const suggestedMax = maxValue < 10 ? 10 : Math.ceil(maxValue + 5);

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps.map(ts => new Date(ts).toLocaleString()),
        datasets: [{
          label: 'CPU Utilization (%)',
          data: values,
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: { display: true, text: 'Time' },
            ticks: { maxTicksLimit: 10 }
          },
          y: {
            title: { display: true, text: 'CPU (%)' },
            min: 0,
            suggestedMax: suggestedMax
          }
        }
      }
    });

    document.getElementById("loadingSpinner").style.display = "none";


  } catch (err) {
    alert('Error fetching data: ' + err.message);
    document.getElementById("loadingSpinner").style.display = "none";
    console.error(err);
  }
});
