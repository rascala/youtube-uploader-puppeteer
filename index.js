const { runScript } = require('./src/script')
const { getCountyHomes, getHomeData } = require('./src/curl')

// const county_homes = getCountyHomes('Alameda').then(counties => {
//     console.log(`counties.length = ${counties.length}`)
// })
// const home_data = getHomeData(4908996).then(home_data => console.log(home_data))

runScript()
