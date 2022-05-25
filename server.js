// Must run npm install
// Must run AlarmDbProvider on localhost:8082
// run "node server.js"
// will save image at C:\Philips.PIC\Sandbox\Common\ACP\ReportEmail\google-chart.png based on data in the Report table in DB (only taking first row in report table)
const GoogleChartsNode = require('google-charts-node');
const fs = require('fs');
const {Client, Pool } = require('pg')
var request = require('request');
// var express = require("express");
// var app = express();
//
// app.listen(3000, () => {
//     console.log("Server running on port 3000");
// });
// app.get("/url", (req, res, next) => {
//     res.json(["Tony","Lisa","Michael","Ginger","Food"]);
// });
const connectionString = 'postgresql://HN9QdpeibIYZUE6H:sFgfV9S8BvN61s8f@localhost:5432/hsdp_pg'
// Define your chart drawing function
// not using as adding dynamic value to data (thus using drawChartStr)
function drawChart() {
    const data = google.visualization.arrayToDataTable([ [ '', ''],
        [ 'ART   Change Scale', 34.89],
        [ 'Resp   Leads Off', 8.22]]);
    const options = {
        title: 'temp chart',
        chartArea: {width: '50%'},
        hAxis: {
            title: 'Val',
            minValue: 0
        },
        vAxis: {
            title: 'Label'
        }
    };
    const chart = new google.visualization.BarChart(container);
    chart.draw(data, options);
}
// based on - https://quickchart.io/documentation/google-charts-image-server/
async function savePNG(renderData) {
    await renderDataStr(renderData).then(async (res) =>{
        // update options object as reqiured
        var drawChartStr = `const data = google.visualization.arrayToDataTable(${res});
            const options = {
            title: 'temp chart',
            chartArea: {width: '50%'},
            hAxis: {
                title: 'Val',
                minValue: 0
            },
            vAxis: {
                title: 'Label'
                }
            };
            const chart = new google.visualization.BarChart(container);
            chart.draw(data, options);`
        // Render the chart to image
        const image = await GoogleChartsNode.render(drawChartStr, {
            width: 400,
            height: 300,
        });
        // change path accordingly
         fs.writeFileSync('C:\\Philips.PIC\\Sandbox\\Common\\ACP\\ReportEmail\\google-chart.png', image);
        console.log("Done")
    })
}
// make 2d array as string with square brackets etc.
async function renderDataStr(renderData){
    str = `[['','']`;
    let i = 0
    for (entry of renderData){
        if (i == 0){
            i += 1
            continue;
        }
        str += `,['` + entry[0] + `',` + entry[1] + `]`
    }
    str += `]`
    return str;
}
async function sendEmail(report) {
    let queryData = report.query_data
    // getQueryInfo and send to AIM
    let payload = constructPayload(queryData)
    // sample working payload
    // payload = {"parameterNameValueList":[{"name":"alarmQueryId","value":"4"},{"name":"startTime","value":"2019-03-21 19:01:01"},{"name":"endTime","value":"2019-10-16 11:02:08"},{"name":"queryLimit","value":30},{"name":"groupType","value":"default"},{"name":"tenantName","value":"EnglishB02"},{"name":"selectedUnits","value":"{ACU,ICU,NICU}"},{"name":"severityLabel","value":"{Cyan,PauseStandby,Red,Severe Cyan,Short Yellow,Silent Cyan,Yellow}"},{"name":"label","value":"% Top Alarms"},{"name":"patient","value":"all"},{"name":"alarm","value":"all"},{"name":"hour","value":"all"},{"name":"bed","value":"all"},{"name":"label_data","value":"all"}]}
    //sample working userinfo object
    // {"alarmQueryId":"4","startTime":"2019-03-21 19:01:01","endTime":"2019-10-16 11:02:08","queryLimit":30,"groupType":"default","tenantName":"EnglishB02","selectedUnits":[{"label":"ACU","selected":true},{"label":"CCU","selected":false},{"label":"ICU","selected":true},{"label":"NICU","selected":true}],"severityLabel":[{"label":"Cyan","selected":true},{"label":"PauseStandby","selected":true},{"label":"Red","selected":true},{"label":"Severe Cyan","selected":true},{"label":"Short Yellow","selected":true},{"label":"Silent Cyan","selected":true},{"label":"Yellow","selected":true}],"label":"% Top Alarms","patient":"all","alarm":"all","hour":"all","bed":"all","label_data":"all"}
    request.post({
        headers: {
            'Content-Type': 'application/json',
            'api-version': '1.0.0',
        },
        url: 'http://localhost:8082/api/query/'+queryData.alarmQueryId, // DBProvider running on local
        body: payload,
        json: true,
    }, async function (err, res, body) {
        // get Alarm data and convert to 2d matrix and update "renderData" with 2d matrix
        let renderData = await reFormatData(body)
        // and then savePNG();
        await savePNG(renderData);
    });
}
async function run() {
    console.log('test');
    const client = new Pool({connectionString,ssl: {
            rejectUnauthorized: false,
        },});
    client.connect();
    const reports = await client.query('SELECT report_name, chart_name, recipient_email, frequency, tenant_name, message, creation_time, next_run_time, query_data\n' +
        'FROM alarm_management.report;\n', (err, res) => {
        sendEmail(res.rows[0])
    });
    client.end();
}
//create Body to be sent to AIM
function formatDigitsLessThanTen(value)
{
    return (value < 10 ? '0' : '') + value;
}
function createCustomDate(date)
{
    let customDate = '';
    const year = date.getFullYear();
    const month = formatDigitsLessThanTen(date.getMonth() + 1);
    const day = formatDigitsLessThanTen(date.getDate());
    const hours = formatDigitsLessThanTen(date.getHours());
    const minutes = formatDigitsLessThanTen(date.getMinutes());
    const seconds = formatDigitsLessThanTen(date.getSeconds());
    customDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return customDate;
}
function getArrayObjectAsString(arr)
{
    let result = arr.join();
    result = '{' + result + '}';
    return result;
}
function getSelectedLabel(list)
{
    const selectedLabels = list.sort((a, b) => (a.label > b.label ? 1 : -1)).filter(obj => obj.selected === true);
    return selectedLabels.map(obj => obj.label);
}
function constructPayload(dto)
{
    const queryDto = JSON.parse(JSON.stringify(dto));
    queryDto.startTime = createCustomDate(new Date(queryDto.startTime));
    queryDto.endTime = createCustomDate(new Date(queryDto.endTime));
    queryDto.selectedUnits = getArrayObjectAsString(getSelectedLabel(queryDto.selectedUnits));
    queryDto.severityLabel = getArrayObjectAsString(getSelectedLabel(queryDto.severityLabel));
    queryDto.alarmQueryId = String(queryDto.alarmQueryId);
    const payload = {"parameterNameValueList": []};
    for (const [key, value] of Object.entries(queryDto))
    {
        const alarmParamNameValue = {"name": null, "value": null};
        alarmParamNameValue.name = key;
        alarmParamNameValue.value = value;
        payload.parameterNameValueList.push(alarmParamNameValue);
    }
    return payload;
}
async function reFormatData(arr)
{
    renderData = [];
    renderData.push(["",""]) //title placeholder
    if (arr !== undefined && arr.length !== 0)
    {
        const Keys = Object.keys(arr[0]);
        for (const obj of arr)
        {
            const temp = [];
            for (const Key of Keys)
            {
                temp.push(obj[Key]);
            }
            // temp.push("");
            renderData.push(temp);
        }
    }
    return renderData;
}
run();